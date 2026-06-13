#!/usr/bin/env python3
"""
半导体供应链图谱 Cypher 导入脚本生成器
读取飞书表格数据 → 解析节点和边 → 生成 .cypher 文件
"""
import json, sys, os

# Column mapping (0-indexed after header skip)
# A=0 资源负责人, B=1 采购, C=2 采购组织, D=3 物料编号(MPNID), E=4 供应商料号
# F=5 供应商, G=6 供应商编码, H=7 业务线, I=8 晶圆厂, J=9 晶圆国家
# K=10 晶圆省/州, L=11 晶圆市, M=12 封装厂, N=13 封装国家
# O=14 封装省/州, P=15 封装市, Q=16 测试厂, R=17 测试国家
# S=18 测试省/州, T=19 测试市, U=20 晶圆制程, V=21 晶圆尺寸
# W=22 晶圆工艺, X=23 封装工艺

def escape_cypher(s):
    """Escape string for Cypher"""
    if s is None:
        return None
    s = str(s).strip()
    if not s or s == 'null' or s == 'None':
        return None
    return s.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", " ")

def split_multi(val):
    """Split multi-value fields by /"""
    if not val:
        return []
    return [v.strip() for v in str(val).split('/') if v.strip()]

def build_location_id(country, state, city):
    """Build a location node ID"""
    parts = []
    if country: parts.append(str(country).strip())
    if state: parts.append(str(state).strip())
    if city: parts.append(str(city).strip())
    return "/".join(parts) if parts else None

def process_sheet(data, sheet_name, output_dir):
    """Process a sheet's data and write Cypher statements"""
    if not data or len(data) < 2:
        print(f"Sheet {sheet_name}: no data")
        return
    
    header = data[0]
    rows = data[1:]
    
    print(f"Sheet {sheet_name}: {len(rows)} rows, {len(header)} cols")
    
    # Track unique nodes for MERGE dedup
    nodes = {
        'mpn': set(),
        'supplier': set(),
        'wafab': set(),
        'pack': set(),
        'test': set(),
        'bizline': set(),
        'country': set(),
        'province': set(),
    }
    
    edges = {
        'supply': set(),       # supplier -> mpn
        'wafer_mfg': set(),    # mpn -> wafab
        'packaging': set(),    # mpn -> pack
        'testing': set(),      # mpn -> test
        'used_by': set(),      # mpn -> bizline
        'located_country': set(),  # factory -> country
        'located_province': set(), # factory -> province
    }
    
    # MPN properties
    mpn_props = {}
    
    for row in rows:
        # Pad row to 24 columns
        while len(row) < 24:
            row.append(None)
        
        mpn = escape_cypher(row[3])       # D: 物料编号
        supplier = escape_cypher(row[5])   # F: 供应商
        bizline = escape_cypher(row[7])    # H: 业务线
        wafab = escape_cypher(row[8])      # I: 晶圆厂
        wafer_country = escape_cypher(row[9])  # J
        wafer_state = escape_cypher(row[10])   # K
        wafer_city = escape_cypher(row[11])    # L
        pack = escape_cypher(row[12])      # M: 封装厂
        pack_country = escape_cypher(row[13])  # N
        pack_state = escape_cypher(row[14])    # O
        pack_city = escape_cypher(row[15])     # P
        test = escape_cypher(row[16])      # Q: 测试厂
        test_country = escape_cypher(row[17])  # R
        test_state = escape_cypher(row[18])    # S
        test_city = escape_cypher(row[19])     # T
        wafer_process = escape_cypher(row[20]) # U
        wafer_size = escape_cypher(row[21])    # V
        wafer_tech = escape_cypher(row[22])    # W
        pack_tech = escape_cypher(row[23])     # X
        
        if not mpn:
            continue
        
        # MPN node
        nodes['mpn'].add(mpn)
        if mpn not in mpn_props:
            mpn_props[mpn] = {
                'process': wafer_process,
                'size': wafer_size,
                'tech': wafer_tech,
                'pack_tech': pack_tech,
            }
        
        # Supplier node + SUPPLIES edge
        if supplier:
            nodes['supplier'].add(supplier)
            edges['supply'].add((supplier, mpn))
        
        # Business line node + USED_BY edge
        if bizline:
            nodes['bizline'].add(bizline)
            edges['used_by'].add((mpn, bizline))
        
        # Wafer fab + location + edges
        if wafab:
            nodes['wafab'].add(wafab)
            edges['wafer_mfg'].add((mpn, wafab))
            if wafer_country:
                nodes['country'].add(wafer_country)
                edges['located_country'].add(('wafab', wafab, wafer_country))
            loc = build_location_id(wafer_country, wafer_state, wafer_city)
            if loc:
                nodes['province'].add(loc)
                edges['located_province'].add(('wafab', wafab, loc))
        
        # Packaging factory + location + edges (handle multi-value)
        if pack:
            pack_factories = split_multi(pack)
            pack_countries = split_multi(pack_country) if pack_country else []
            pack_states = split_multi(pack_state) if pack_state else []
            pack_cities = split_multi(pack_city) if pack_city else []
            
            for i, pf in enumerate(pack_factories):
                pf_esc = escape_cypher(pf)
                if not pf_esc:
                    continue
                nodes['pack'].add(pf_esc)
                edges['packaging'].add((mpn, pf_esc))
                
                # Location (use index, fallback to first)
                pc = pack_countries[i] if i < len(pack_countries) else (pack_countries[0] if pack_countries else None)
                ps = pack_states[i] if i < len(pack_states) else (pack_states[0] if pack_states else None)
                pk = pack_cities[i] if i < len(pack_cities) else (pack_cities[0] if pack_cities else None)
                
                if pc:
                    pc_esc = escape_cypher(pc)
                    nodes['country'].add(pc_esc)
                    edges['located_country'].add(('pack', pf_esc, pc_esc))
                loc = build_location_id(pc, ps, pk)
                if loc:
                    nodes['province'].add(loc)
                    edges['located_province'].add(('pack', pf_esc, loc))
        
        # Test factory + location + edges (handle multi-value)
        if test:
            test_factories = split_multi(test)
            test_countries = split_multi(test_country) if test_country else []
            test_states = split_multi(test_state) if test_state else []
            test_cities = split_multi(test_city) if test_city else []
            
            for i, tf in enumerate(test_factories):
                tf_esc = escape_cypher(tf)
                if not tf_esc:
                    continue
                nodes['test'].add(tf_esc)
                edges['testing'].add((mpn, tf_esc))
                
                tc = test_countries[i] if i < len(test_countries) else (test_countries[0] if test_countries else None)
                ts = test_states[i] if i < len(test_states) else (test_states[0] if test_states else None)
                tk = test_cities[i] if i < len(test_cities) else (test_cities[0] if test_cities else None)
                
                if tc:
                    tc_esc = escape_cypher(tc)
                    nodes['country'].add(tc_esc)
                    edges['located_country'].add(('test', tf_esc, tc_esc))
                loc = build_location_id(tc, ts, tk)
                if loc:
                    nodes['province'].add(loc)
                    edges['located_province'].add(('test', tf_esc, loc))
    
    # Write Cypher file
    filepath = os.path.join(output_dir, f'{sheet_name}.cypher')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"// 半导体供应链图谱 - {sheet_name}\n")
        f.write(f"// 自动生成，请勿手动编辑\n")
        f.write(f"// 节点: MPN={len(nodes['mpn'])}, 供应商={len(nodes['supplier'])}, 晶圆厂={len(nodes['wafab'])}, 封装厂={len(nodes['pack'])}, 测试厂={len(nodes['test'])}, 业务线={len(nodes['bizline'])}, 国家={len(nodes['country'])}, 省市={len(nodes['province'])}\n\n")
        
        # Create indexes
        f.write("// === 索引 ===\n")
        f.write("CREATE INDEX IF NOT EXISTS FOR (n:MPN) ON (n.id);\n")
        f.write("CREATE INDEX IF NOT EXISTS FOR (n:Supplier) ON (n.id);\n")
        f.write("CREATE INDEX IF NOT EXISTS FOR (n:WaferFab) ON (n.id);\n")
        f.write("CREATE INDEX IF NOT EXISTS FOR (n:PackagingFactory) ON (n.id);\n")
        f.write("CREATE INDEX IF NOT EXISTS FOR (n:TestFactory) ON (n.id);\n")
        f.write("CREATE INDEX IF NOT EXISTS FOR (n:BusinessLine) ON (n.id);\n")
        f.write("CREATE INDEX IF NOT EXISTS FOR (n:Country) ON (n.id);\n")
        f.write("CREATE INDEX IF NOT EXISTS FOR (n:Province) ON (n.id);\n\n")
        
        # Nodes
        f.write("// === 物料(MPN) 节点 ===\n")
        for mpn in sorted(nodes['mpn']):
            props = mpn_props.get(mpn, {})
            prop_parts = [f"id: '{mpn}'"]
            if props.get('process'): prop_parts.append(f"晶圆制程: '{props['process']}'")
            if props.get('size'): prop_parts.append(f"晶圆尺寸: '{props['size']}'")
            if props.get('tech'): prop_parts.append(f"晶圆工艺: '{props['tech']}'")
            if props.get('pack_tech'): prop_parts.append(f"封装工艺: '{props['pack_tech']}'")
            f.write(f"MERGE (n:MPN {{{', '.join(prop_parts)}}});\n")
        
        f.write(f"\n// === 供应商 节点 ({len(nodes['supplier'])}个) ===\n")
        for s in sorted(nodes['supplier']):
            f.write(f"MERGE (n:Supplier {{id: '{s}'}});\n")
        
        f.write(f"\n// === 晶圆厂 节点 ({len(nodes['wafab'])}个) ===\n")
        for w in sorted(nodes['wafab']):
            f.write(f"MERGE (n:WaferFab {{id: '{w}'}});\n")
        
        f.write(f"\n// === 封装厂 节点 ({len(nodes['pack'])}个) ===\n")
        for p in sorted(nodes['pack']):
            f.write(f"MERGE (n:PackagingFactory {{id: '{p}'}});\n")
        
        f.write(f"\n// === 测试厂 节点 ({len(nodes['test'])}个) ===\n")
        for t in sorted(nodes['test']):
            f.write(f"MERGE (n:TestFactory {{id: '{t}'}});\n")
        
        f.write(f"\n// === 业务线 节点 ({len(nodes['bizline'])}个) ===\n")
        for b in sorted(nodes['bizline']):
            f.write(f"MERGE (n:BusinessLine {{id: '{b}'}});\n")
        
        f.write(f"\n// === 国家 节点 ({len(nodes['country'])}个) ===\n")
        for c in sorted(nodes['country']):
            f.write(f"MERGE (n:Country {{id: '{c}'}});\n")
        
        f.write(f"\n// === 省市 节点 ({len(nodes['province'])}个) ===\n")
        for p in sorted(nodes['province']):
            f.write(f"MERGE (n:Province {{id: '{p}'}});\n")
        
        # Edges
        f.write(f"\n// === 供应关系 (供应商→物料) ===\n")
        for s, m in sorted(edges['supply']):
            f.write(f"MATCH (a:Supplier {{id: '{s}'}}), (b:MPN {{id: '{m}'}}) MERGE (a)-[:SUPPLIES]->(b);\n")
        
        f.write(f"\n// === 晶圆制造关系 (物料→晶圆厂) ===\n")
        for m, w in sorted(edges['wafer_mfg']):
            f.write(f"MATCH (a:MPN {{id: '{m}'}}), (b:WaferFab {{id: '{w}'}}) MERGE (a)-[:WAFER_MFG]->(b);\n")
        
        f.write(f"\n// === 封装关系 (物料→封装厂) ===\n")
        for m, p in sorted(edges['packaging']):
            f.write(f"MATCH (a:MPN {{id: '{m}'}}), (b:PackagingFactory {{id: '{p}'}}) MERGE (a)-[:PACKAGED_BY]->(b);\n")
        
        f.write(f"\n// === 测试关系 (物料→测试厂) ===\n")
        for m, t in sorted(edges['testing']):
            f.write(f"MATCH (a:MPN {{id: '{m}'}}), (b:TestFactory {{id: '{t}'}}) MERGE (a)-[:TESTED_BY]->(b);\n")
        
        f.write(f"\n// === 用途关系 (物料→业务线) ===\n")
        for m, b in sorted(edges['used_by']):
            f.write(f"MATCH (a:MPN {{id: '{m}'}}), (b:BusinessLine {{id: '{b}'}}) MERGE (a)-[:USED_BY]->(b);\n")
        
        f.write(f"\n// === 位于-国家级 (工厂→国家) ===\n")
        for ftype, fid, cid in sorted(edges['located_country']):
            label = {'wafab': 'WaferFab', 'pack': 'PackagingFactory', 'test': 'TestFactory'}[ftype]
            f.write(f"MATCH (a:{label} {{id: '{fid}'}}), (b:Country {{id: '{cid}'}}) MERGE (a)-[:LOCATED_IN]->(b);\n")
        
        f.write(f"\n// === 位于-省市级 (工厂→省市) ===\n")
        for ftype, fid, pid in sorted(edges['located_province']):
            label = {'wafab': 'WaferFab', 'pack': 'PackagingFactory', 'test': 'TestFactory'}[ftype]
            f.write(f"MATCH (a:{label} {{id: '{fid}'}}), (b:Province {{id: '{pid}'}}) MERGE (a)-[:LOCATED_IN]->(b);\n")
    
    print(f"Written: {filepath}")
    return {
        'sheet': sheet_name,
        'rows': len(rows),
        'nodes': {k: len(v) for k, v in nodes.items()},
        'edges': {k: len(v) for k, v in edges.items()},
    }

if __name__ == '__main__':
    data_file = sys.argv[1] if len(sys.argv) > 1 else '/tmp/neo4j_data.json'
    output_dir = sys.argv[2] if len(sys.argv) > 2 else '/tmp/neo4j_cypher'
    
    os.makedirs(output_dir, exist_ok=True)
    
    with open(data_file, 'r', encoding='utf-8') as f:
        all_data = json.load(f)
    
    stats = []
    for sheet_name, data in all_data.items():
        result = process_sheet(data, sheet_name, output_dir)
        if result:
            stats.append(result)
    
    # Print summary
    print("\n=== 汇总 ===")
    for s in stats:
        print(f"  {s['sheet']}: {s['rows']} rows, nodes={s['nodes']}, edges={s['edges']}")
