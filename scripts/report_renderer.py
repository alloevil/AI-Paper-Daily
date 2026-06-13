"""投资日报 v7 — 精确对齐 + 浅色主题"""
import fitz

W = 880
M = 48
CW = W - 2*M

# 浅色主题
BG = (0.98, 0.98, 0.99)
CARD = (1.0, 1.0, 1.0)
BORDER = (0.85, 0.85, 0.88)
TEXT = (0.12, 0.12, 0.14)
DIM = (0.40, 0.40, 0.45)
FAINT = (0.45, 0.45, 0.50)
PURPLE = (0.45, 0.25, 0.90)
GREEN = (0.15, 0.68, 0.42)
RED = (0.90, 0.25, 0.25)
YELLOW = (0.85, 0.60, 0.05)
BODY = (0.30, 0.30, 0.35)
TAG_BG = (0.95, 0.95, 0.97)
PILL_BG = (0.93, 0.90, 0.99)

# 字体
F = fitz.Font(fontfile="/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")
FB = fitz.Font(fontfile="/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc")
FM = fitz.Font(fontname="cour")

def tw(text, sz, bold=False, mono=False):
    f = FM if mono else (FB if bold else F)
    return f.text_length(text, fontsize=sz)

doc = fitz.open()
page = doc.new_page(width=W, height=3500)
page.draw_rect(fitz.Rect(0,0,W,3500), fill=BG)

page.insert_font(fontname="noto", fontbuffer=open("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc","rb").read())
page.insert_font(fontname="notob", fontbuffer=open("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc","rb").read())
page.insert_font(fontname="cour")

y = M

def txt(text, x, sz=14, color=TEXT, bold=False, mono=False):
    global y
    fn = "cour" if mono else ("notob" if bold else "noto")
    page.insert_text(fitz.Point(x, y+sz), text, fontsize=sz, fontname=fn, color=color)

def txt_r(text, xr, sz=14, color=TEXT, bold=False, mono=False):
    global y
    fn = "cour" if mono else ("notob" if bold else "noto")
    t = tw(text, sz, bold, mono)
    page.insert_text(fitz.Point(xr-t, y+sz), text, fontsize=sz, fontname=fn, color=color)

def sk(h=8): global y; y += h

def rect(x1,y1,x2,y2,color=None,fill=None,w=0.5):
    page.draw_rect(fitz.Rect(x1,y1,x2,y2), color=color, fill=fill, width=w)

def card(h):
    global y
    rect(M, y, W-M, y+h, color=BORDER, fill=CARD, w=1.0)

def wrap_text(text, x_start, x_end, sz, bold=False, mono=False, color=BODY, line_h=None):
    """自动换行渲染文字，返回占用行数"""
    global y
    if line_h is None:
        line_h = sz * 1.7
    max_w = x_end - x_start
    line = ""
    lines = 0
    for ch in text:
        test = line + ch
        if tw(test, sz, bold, mono) > max_w:
            txt(line, x_start, sz=sz, color=color, bold=bold, mono=mono)
            sk(line_h)
            line = ch
            lines += 1
        else:
            line = test
    if line:
        txt(line, x_start, sz=sz, color=color, bold=bold, mono=mono)
        sk(line_h)
        lines += 1
    return lines

def tag(text, x, fg=DIM):
    global y
    sz = 10.5
    t = tw(text, sz, bold=True)
    pw = t + 14
    rect(x, y, x+pw, y+20, color=(fg[0],fg[1],fg[2],0.3), fill=TAG_BG, w=0.5)
    page.insert_text(fitz.Point(x+7, y+sz+2), text, fontsize=sz, fontname="notob", color=fg)
    return pw + 6

def pill(text, x, fg=PURPLE):
    global y
    sz = 11
    t = tw(text, sz, bold=True)
    pw = t + 16
    rect(x, y, x+pw, y+22, color=fg, fill=(fg[0],fg[1],fg[2],0.12), w=0.8)
    page.insert_text(fitz.Point(x+8, y+sz+3), text, fontsize=sz, fontname="notob", color=fg)
    return pw + 6

def section(title, symbol="●", accent=PURPLE):
    global y
    txt(symbol, M, sz=10, color=accent, bold=True)
    txt(title, M+16, sz=13, color=DIM, bold=True)
    sk(22)

def asset(name, ticker, price, pct, pct_c, tags_d, body, pills_d=None):
    """资产卡片 — 精确对齐"""
    global y
    x_l = M + 20
    x_r = W - M - 20
    
    # 计算卡片高度
    body_h = len(body) * 24  # 每行固定高度
    pills_h = 32 if pills_d else 0
    ch = 76 + body_h + pills_h
    card(ch)
    
    # === 行1：名称 + ticker + 价格 + 涨跌（同一基线）===
    name_y = y
    txt(name, x_l, sz=18, bold=True)
    t = tw(name, 18, bold=True)
    txt(ticker, x_l+t+10, sz=11, color=FAINT, mono=True)
    # 价格右对齐
    pw = tw(price, 24, mono=True)
    pct_tw = tw(pct, 14, mono=True, bold=True)
    # 价格和涨跌在同一行，手动定位
    page.insert_text(fitz.Point(x_r-pw, y+18+24), price, fontsize=24, fontname="cour", color=TEXT)
    page.insert_text(fitz.Point(x_r-pw-pct_tw-10, y+18+14), pct, fontsize=14, fontname="cour", color=pct_c)
    
    y += 38  # 固定偏移到标签行
    
    # === 行2：标签 ===
    tx = x_l
    cs = {"default":DIM, "warn":YELLOW, "danger":RED, "good":GREEN, "accent":PURPLE}
    for t2, s in tags_d:
        tx += tag(t2, tx, cs.get(s, DIM))
    
    y += 26  # 固定偏移到描述行
    
    # === 行3：描述文字（自动换行）===
    for line in body:
        wrap_text(line, x_l, x_r, 13.5, color=BODY)
        sk(2)  # 行间微间距
    
    # === 行4：Pill 按钮 ===
    if pills_d:
        y += 4
        px = x_l
        for pt, pc in pills_d:
            px += pill(pt, px, pc)
        y += 28
    
    y += 14  # 卡片底部间距

# ========== 内容 ==========

# Header
txt("投资作战总日报", M, sz=30, bold=True)
txt("2026.06.05 · Thursday · 美股 / 港股 / A股", M, sz=12, color=FAINT)
sk(14)
txt_r("¥667,248", W-M, sz=36, mono=True, bold=True)
sk(-6)
txt_r("+ ¥37,436", W-M, sz=15, color=GREEN, mono=True, bold=True)
sk(2)
txt_r("小米 57.5% · PONY 27.9% · 85.4%", W-M, sz=11, color=FAINT)
sk(24)
rect(M, y, W-M, y, color=BORDER)
sk(28)

# 核心判断
card(92)
rect(M, y, M+4, y+92, fill=PURPLE)
txt("核心判断", M+20, sz=10, color=PURPLE, bold=True)
sk(16)
txt("VIX 暴涨 40% + 就业数据冲击利率预期，成长股遭系统性杀估值，", M+20, sz=14.5, color=BODY)
sk(24)
txt("小米 / PONY / TEM 集体逼 52 周低点 —— 板块共振，非个股恶化。", M+20, sz=14.5, color=BODY)
y += 100

# 宏观指标 — 精确对齐
mh = 80
macro = [("10Y 美债","4.54%","利率承压",DIM), ("VIX","21.51","+39.7%",RED),
         ("美元","100.08","—",DIM), ("黄金","4,368","避险升温",GREEN), ("原油","95.41","—",DIM)]
mw = CW / len(macro)
rect(M, y, W-M, y+mh, color=BORDER, fill=(0.96,0.96,0.97))

# 宏观指标基线对齐
label_y = y + 22
val_y = y + 46
delta_y = y + 64
for i,(lab,val,delta,dc) in enumerate(macro):
    cx = M + i*mw + mw/2
    # 标签 — 水平居中
    vl = tw(lab, 9, bold=True)
    page.insert_text(fitz.Point(cx-vl/2, label_y), lab, fontsize=9, fontname="notob", color=FAINT)
    # 数值 — 水平居中，统一基线
    vv = tw(val, 18, mono=True)
    page.insert_text(fitz.Point(cx-vv/2, val_y), val, fontsize=18, fontname="cour", color=TEXT)
    # delta — 水平居中，统一基线
    vd = tw(delta, 11, mono=True)
    page.insert_text(fitz.Point(cx-vd/2, delta_y), delta, fontsize=11, fontname="cour", color=dc)
y += mh + 32

# 锚仓
section("锚仓", "●")
asset("小米","01810.HK","27.80","-2.0%",RED,
    [("仓位 57.5%","default"),("52周位 1%","good"),("RSI 27 超卖","warn"),("沽空 ↓ 18.3%","good")],
    ["跌幅仅 -2%，远小于 PONY / TEM，有支撑。沽空比例较 5 日均 26% 大幅下降。"],
    [("不加不减",PURPLE),("跌破 26.00 → 左侧机会",YELLOW)])

# 弹性仓
section("弹性仓", "●")
asset("PONY 小马智行","PONY","8.62","-9.8%",RED,
    [("仓位 27.9%","default"),("52周低 7.9%","danger"),("RSI 53","default"),("6/4 港股通","accent")],
    ["港股通刚纳入，基本面 Q1 拐点确认未变。板块杀估值共振。"],
    [("不操作",PURPLE),("$8.00 破位 + 放量 2x → 减仓至 20%",YELLOW)])

asset("Tempus AI","TEM","46.43","-11.2%",RED,
    [("仓位 10.0%","default"),("52周低 8%","danger"),("日内振幅 14%","warn")],
    ["日内 $52.26 → $46.43。社交有 insiders selling [待确认]"],
    [("不操作",PURPLE),("周一验证 SEC",DIM),("$42 → 止损评估",YELLOW)])

asset("恒瑞医药","600276.SS","47.08","+1.0%",GREEN,
    [("仓位 2.8%","default"),("RSI 24","warn"),("唯一微涨","good")],
    ["防御属性体现，成长股暴跌中逆势微涨。超卖区间，观察为主。"])

asset("国电南瑞","600406.SS","23.45","-1.5%",RED,
    [("仓位 1.8%","default"),("RSI 22","warn"),("电力抗跌","good")],
    ["电力板块相对稳健，跌幅远小于成长股。"])

# 观察仓
section("观察仓", "◆")
asset("泡泡玛特","9992.HK","176.4","-0.6%",RED,
    [("5日 +1.7%","good"),("20日 +8.8%","good"),("观察池最强","accent")],
    ["消费 + 出海逻辑未受成长股共振，独立行情。"])

asset("688017","688017.SS","393.0","+20.0%",GREEN,
    [("52周高 100%","accent"),("5日 +28.4%","warn")],
    ["独立行情。不追高。"],
    [("缩量回调守 350 → 建小仓",PURPLE)])

asset("Adobe","ADBE","251.44","-2.7%",RED,[("4天后 Q2 财报","warn")],["财报前不加仓。"])
asset("百济神州","06160.HK","163.00","-2.9%",RED,[],["跟随大盘，无独立利空。"])
asset("特变电工","600089.SS","25.71","+0.2%",GREEN,[("电力稳健","good")],[])

# 雷达
section("第二曲线雷达", "◉")
for title,desc,sig,mapping in [
    ("具身智能融资密集 · 深圳+杭州","星尘智能超 10 亿 B 轮破百亿估值，大模型公司构建生态链","从实验室进入产业化","小米机器人 · 港股科技"),
    ("AI 基础设施 · 开发者工具持续吸金","推理成本优化连续融资，Anthropic 称 80% 代码由 Claude 编写","从\"能不能用\"进入\"怎么用好\"",None),
    ("半导体链式抛售 · AI 叙事重估","Broadcom 指引失望 → 半导体全面抛售 → Nasdaq 暴跌 ~4%","估值重置，非逻辑崩塌","验证：6/11 CPI")]:
    x_l = M + 20
    x_r = W - M - 20
    card(74)
    page.draw_circle(fitz.Point(M+28, y+16), 4, fill=PURPLE)
    txt(title, M+40, sz=14, bold=True)
    sk(26)
    wrap_text(desc, x_l, x_r, 12.5, color=DIM)
    sk(2)
    txt(sig, x_l, sz=12.5, color=GREEN, bold=True)
    if mapping:
        t2 = tw(sig, 12.5, bold=True)
        txt("  ·  "+mapping, x_l+t2+10, sz=12.5, color=PURPLE)
    y += 14

# 风险
section("风险边界", "▲", RED)
for i,r in enumerate([
    "CPI 超预期 → 加息强化 → PONY 跌破 $8.00 概率大增",
    "TEM insider selling 若 SEC 证实 → 减仓至 5% 以下",
    "小米跌破 26.00 无 Q2 利好 → 承压但不砍",
    "VIX > 20 超 1 周 → 系统性风险升级，全面不加仓",
    "PONY 南向资金 3 日未净买入 → 港股通利好可能被高估"]):
    x_l = M + 30
    txt(f"{i+1:02d}", M, sz=12, color=RED, mono=True, bold=True)
    wrap_text(r, x_l, W-M, 13.5, color=BODY, line_h=22)
    y += 2
    rect(M, y, W-M, y, color=(0.92,0.92,0.94))
    y += 6
y += 10

# 提醒
rw = (CW-12)/2; rh = 72
for i,(when,what) in enumerate([("6/11 · 3 天后","美国 5 月 CPI · 成长股关键转折"),("6 月中旬","Adobe Q2 财报 · 观察仓")]):
    rx = M + i*(rw+12)
    rect(rx, y, rx+rw, y+rh, color=PURPLE, fill=PILL_BG, w=0.8)
    # 文字垂直居中
    page.insert_text(fitz.Point(rx+18, y+28), when, fontsize=10, fontname="notob", color=PURPLE)
    page.insert_text(fitz.Point(rx+18, y+48), what, fontsize=13, fontname="noto", color=BODY)
y += rh + 28

# Footer
fl = "GENERATED BY 元气小虾 / OPENCLAW"
fw = tw(fl, 10, bold=True)
page.insert_text(fitz.Point(W/2-fw/2, y), fl, fontsize=10, fontname="notob", color=FAINT)

# 输出
ah = y + 20
pix = page.get_pixmap(dpi=200, clip=fitz.Rect(0, 0, W, ah))
pix.save("/tmp/daily_report_v7.png")
print(f"done: {pix.width}x{pix.height}, content_h={ah}")
