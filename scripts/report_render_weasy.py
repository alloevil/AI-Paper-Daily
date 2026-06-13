"""投资日报 v8 — HTML + insert_htmlbox 精美渲染"""
import fitz

W = 880
MARGIN = 36

html = """
<div style="
    font-family: 'Noto Sans CJK SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: linear-gradient(180deg, #f8f9fc 0%, #eef0f5 100%);
    padding: 40px 36px 32px;
    color: #1a1a2e;
    line-height: 1.6;
">
    <!-- 顶部品牌色带 -->
    <div style="
        position: absolute; top: 0; left: 0; right: 0; height: 4px;
        background: linear-gradient(90deg, #6c5ce7, #a29bfe, #6c5ce7);
    "></div>

    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #e0e3ea;">
        <div>
            <div style="font-size: 26px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px;">投资作战总日报</div>
            <div style="font-size: 11px; color: #8b8fa3; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px;">2026.06.05 · Thursday · 美股 / 港股 / A股</div>
        </div>
        <div style="text-align: right;">
            <div style="font-size: 32px; font-weight: 800; color: #1a1a2e; font-family: 'Courier New', monospace;">¥667,248</div>
            <div style="font-size: 14px; font-weight: 700; color: #00b894; font-family: 'Courier New', monospace; margin-top: 2px;">+ ¥37,436</div>
            <div style="font-size: 10px; color: #8b8fa3; margin-top: 4px;">小米 57.5% · PONY 27.9% · 集中度 85.4%</div>
        </div>
    </div>

    <!-- 核心判断 -->
    <div style="
        background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;
        border-left: 4px solid #6c5ce7;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    ">
        <div style="font-size: 10px; font-weight: 700; color: #6c5ce7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px;">核心判断</div>
        <div style="font-size: 14px; color: #4a4a5a; line-height: 1.8;">
            VIX 暴涨 40% + 就业数据冲击利率预期，成长股遭系统性杀估值，小米 / PONY / TEM 集体逼 52 周低点 —— <strong style="color: #1a1a2e;">板块共振，非个股恶化</strong>。
        </div>
    </div>

    <!-- 宏观指标 -->
    <div style="display: flex; gap: 8px; margin-bottom: 28px;">
        <div style="flex: 1; background: #fff; border-radius: 10px; padding: 14px 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="font-size: 9px; font-weight: 700; color: #8b8fa3; letter-spacing: 1.5px; text-transform: uppercase;">10Y 美债</div>
            <div style="font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace; margin-top: 4px;">4.54%</div>
            <div style="font-size: 10px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-top: 2px;">利率承压</div>
        </div>
        <div style="flex: 1; background: #fff; border-radius: 10px; padding: 14px 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="font-size: 9px; font-weight: 700; color: #8b8fa3; letter-spacing: 1.5px; text-transform: uppercase;">VIX</div>
            <div style="font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace; margin-top: 4px;">21.51</div>
            <div style="font-size: 10px; color: #e74c3c; font-weight: 700; font-family: 'Courier New', monospace; margin-top: 2px;">+39.7%</div>
        </div>
        <div style="flex: 1; background: #fff; border-radius: 10px; padding: 14px 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="font-size: 9px; font-weight: 700; color: #8b8fa3; letter-spacing: 1.5px; text-transform: uppercase;">美元指数</div>
            <div style="font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace; margin-top: 4px;">100.08</div>
            <div style="font-size: 10px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-top: 2px;">—</div>
        </div>
        <div style="flex: 1; background: #fff; border-radius: 10px; padding: 14px 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="font-size: 9px; font-weight: 700; color: #8b8fa3; letter-spacing: 1.5px; text-transform: uppercase;">黄金</div>
            <div style="font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace; margin-top: 4px;">4,368</div>
            <div style="font-size: 10px; color: #00b894; font-family: 'Courier New', monospace; margin-top: 2px;">避险升温</div>
        </div>
        <div style="flex: 1; background: #fff; border-radius: 10px; padding: 14px 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="font-size: 9px; font-weight: 700; color: #8b8fa3; letter-spacing: 1.5px; text-transform: uppercase;">布伦特原油</div>
            <div style="font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace; margin-top: 4px;">95.41</div>
            <div style="font-size: 10px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-top: 2px;">—</div>
        </div>
    </div>

    <!-- Section: 锚仓 -->
    <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #6c5ce7;"></div>
            <div style="font-size: 12px; font-weight: 700; color: #8b8fa3; letter-spacing: 1.5px; text-transform: uppercase;">锚仓</div>
        </div>

        <!-- 小米 -->
        <div style="background: #fff; border-radius: 12px; padding: 18px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                    <span style="font-size: 17px; font-weight: 700; color: #1a1a2e;">小米</span>
                    <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">01810.HK</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">27.80</span>
                    <span style="font-size: 13px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; margin-left: 8px;">-2.0%</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #f0f0f5; color: #6b6b80;">仓位 57.5%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #e8f8f0; color: #00b894;">52周位 1%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #fff8e8; color: #d4a017;">RSI 27 超卖</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #e8f8f0; color: #00b894;">沽空 ↓ 18.3%</span>
            </div>
            <div style="font-size: 13px; color: #5a5a6e; line-height: 1.7; margin-bottom: 12px;">
                跌幅仅 -2%，远小于 PONY / TEM，有支撑。沽空比例较 5 日均 26% 大幅下降。
            </div>
            <div style="display: flex; gap: 8px;">
                <span style="font-size: 11px; font-weight: 600; padding: 5px 14px; border-radius: 20px; background: rgba(108,92,231,0.08); color: #6c5ce7; border: 1px solid rgba(108,92,231,0.2);">不加不减</span>
                <span style="font-size: 11px; font-weight: 600; padding: 5px 14px; border-radius: 20px; background: rgba(212,160,23,0.08); color: #d4a017; border: 1px solid rgba(212,160,23,0.2);">跌破 26.00 → 左侧机会</span>
            </div>
        </div>

        <!-- PONY -->
        <div style="background: #fff; border-radius: 12px; padding: 18px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                    <span style="font-size: 17px; font-weight: 700; color: #1a1a2e;">PONY 小马智行</span>
                    <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">PONY</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">8.62</span>
                    <span style="font-size: 13px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; margin-left: 8px;">-9.8%</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #f0f0f5; color: #6b6b80;">仓位 27.9%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #fde8e8; color: #e74c3c;">52周低 7.9%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #f0f0f5; color: #6b6b80;">RSI 53</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: rgba(108,92,231,0.08); color: #6c5ce7;">6/4 港股通</span>
            </div>
            <div style="font-size: 13px; color: #5a5a6e; line-height: 1.7; margin-bottom: 12px;">
                港股通刚纳入，基本面 Q1 拐点确认未变。板块杀估值共振。
            </div>
            <div style="display: flex; gap: 8px;">
                <span style="font-size: 11px; font-weight: 600; padding: 5px 14px; border-radius: 20px; background: rgba(108,92,231,0.08); color: #6c5ce7; border: 1px solid rgba(108,92,231,0.2);">不操作</span>
                <span style="font-size: 11px; font-weight: 600; padding: 5px 14px; border-radius: 20px; background: rgba(212,160,23,0.08); color: #d4a017; border: 1px solid rgba(212,160,23,0.2);">$8.00 破位 + 放量 2x → 减仓至 20%</span>
            </div>
        </div>

        <!-- TEM -->
        <div style="background: #fff; border-radius: 12px; padding: 18px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                    <span style="font-size: 17px; font-weight: 700; color: #1a1a2e;">Tempus AI</span>
                    <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">TEM</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">46.43</span>
                    <span style="font-size: 13px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; margin-left: 8px;">-11.2%</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #f0f0f5; color: #6b6b80;">仓位 10.0%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #fde8e8; color: #e74c3c;">52周低 8%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #fff8e8; color: #d4a017;">日内振幅 14%</span>
            </div>
            <div style="font-size: 13px; color: #5a5a6e; line-height: 1.7; margin-bottom: 12px;">
                日内 $52.26 → $46.43。社交有 insiders selling <strong style="color: #1a1a2e;">[待确认]</strong>
            </div>
            <div style="display: flex; gap: 8px;">
                <span style="font-size: 11px; font-weight: 600; padding: 5px 14px; border-radius: 20px; background: rgba(108,92,231,0.08); color: #6c5ce7; border: 1px solid rgba(108,92,231,0.2);">不操作</span>
                <span style="font-size: 11px; font-weight: 600; padding: 5px 14px; border-radius: 20px; background: #f0f0f5; color: #6b6b80; border: 1px solid #e0e3ea;">周一验证 SEC</span>
                <span style="font-size: 11px; font-weight: 600; padding: 5px 14px; border-radius: 20px; background: rgba(212,160,23,0.08); color: #d4a017; border: 1px solid rgba(212,160,23,0.2);">$42 → 止损评估</span>
            </div>
        </div>

        <!-- 恒瑞 -->
        <div style="background: #fff; border-radius: 12px; padding: 18px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                    <span style="font-size: 17px; font-weight: 700; color: #1a1a2e;">恒瑞医药</span>
                    <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">600276.SS</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">47.08</span>
                    <span style="font-size: 13px; font-weight: 700; color: #00b894; font-family: 'Courier New', monospace; margin-left: 8px;">+1.0%</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #f0f0f5; color: #6b6b80;">仓位 2.8%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #fff8e8; color: #d4a017;">RSI 24</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #e8f8f0; color: #00b894;">唯一微涨</span>
            </div>
            <div style="font-size: 13px; color: #5a5a6e; line-height: 1.7;">防御属性体现，成长股暴跌中逆势微涨。超卖区间，观察为主。</div>
        </div>

        <!-- 国电南瑞 -->
        <div style="background: #fff; border-radius: 12px; padding: 18px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                    <span style="font-size: 17px; font-weight: 700; color: #1a1a2e;">国电南瑞</span>
                    <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">600406.SS</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">23.45</span>
                    <span style="font-size: 13px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; margin-left: 8px;">-1.5%</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #f0f0f5; color: #6b6b80;">仓位 1.8%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #fff8e8; color: #d4a017;">RSI 22</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #e8f8f0; color: #00b894;">电力抗跌</span>
            </div>
            <div style="font-size: 13px; color: #5a5a6e; line-height: 1.7;">电力板块相对稳健，跌幅远小于成长股。</div>
        </div>
    </div>

    <!-- Section: 观察仓 -->
    <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 6px; height: 6px; border-radius: 2px; background: #6c5ce7;"></div>
            <div style="font-size: 12px; font-weight: 700; color: #8b8fa3; letter-spacing: 1.5px; text-transform: uppercase;">观察仓</div>
        </div>

        <!-- 泡泡玛特 -->
        <div style="background: #fff; border-radius: 12px; padding: 18px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div>
                    <span style="font-size: 17px; font-weight: 700; color: #1a1a2e;">泡泡玛特</span>
                    <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">9992.HK</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">176.4</span>
                    <span style="font-size: 13px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; margin-left: 8px;">-0.6%</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #e8f8f0; color: #00b894;">5日 +1.7%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #e8f8f0; color: #00b894;">20日 +8.8%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: rgba(108,92,231,0.08); color: #6c5ce7;">观察池最强</span>
            </div>
            <div style="font-size: 13px; color: #5a5a6e; line-height: 1.7;">消费 + 出海逻辑未受成长股共振，独立行情。</div>
        </div>

        <!-- 其他观察仓简写 -->
        <div style="background: #fff; border-radius: 12px; padding: 18px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div>
                    <span style="font-size: 17px; font-weight: 700; color: #1a1a2e;">688017</span>
                    <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">688017.SS</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">393.0</span>
                    <span style="font-size: 13px; font-weight: 700; color: #00b894; font-family: 'Courier New', monospace; margin-left: 8px;">+20.0%</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: rgba(108,92,231,0.08); color: #6c5ce7;">52周高 100%</span>
                <span style="font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #fff8e8; color: #d4a017;">5日 +28.4%</span>
            </div>
            <div style="font-size: 13px; color: #5a5a6e; line-height: 1.7;">独立行情。不追高。</div>
        </div>

        <div style="background: #fff; border-radius: 12px; padding: 14px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="font-size: 15px; font-weight: 700; color: #1a1a2e;">Adobe</span>
                <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">ADBE</span>
                <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: #fff8e8; color: #d4a017; margin-left: 12px;">4天后 Q2 财报</span>
            </div>
            <div>
                <span style="font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">251.44</span>
                <span style="font-size: 12px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; margin-left: 6px;">-2.7%</span>
            </div>
        </div>

        <div style="background: #fff; border-radius: 12px; padding: 14px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="font-size: 15px; font-weight: 700; color: #1a1a2e;">百济神州</span>
                <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">06160.HK</span>
                <span style="font-size: 12px; color: #5a5a6e; margin-left: 12px;">跟随大盘</span>
            </div>
            <div>
                <span style="font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">163.00</span>
                <span style="font-size: 12px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; margin-left: 6px;">-2.9%</span>
            </div>
        </div>

        <div style="background: #fff; border-radius: 12px; padding: 14px 22px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="font-size: 15px; font-weight: 700; color: #1a1a2e;">特变电工</span>
                <span style="font-size: 11px; color: #8b8fa3; font-family: 'Courier New', monospace; margin-left: 8px;">600089.SS</span>
                <span style="font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: #e8f8f0; color: #00b894; margin-left: 12px;">电力稳健</span>
            </div>
            <div>
                <span style="font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'Courier New', monospace;">25.71</span>
                <span style="font-size: 12px; font-weight: 700; color: #00b894; font-family: 'Courier New', monospace; margin-left: 6px;">+0.2%</span>
            </div>
        </div>
    </div>

    <!-- 风险边界 -->
    <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 6px; height: 6px; border-radius: 2px; background: #e74c3c;"></div>
            <div style="font-size: 12px; font-weight: 700; color: #8b8fa3; letter-spacing: 1.5px; text-transform: uppercase;">风险边界</div>
        </div>
        <div style="background: #fff; border-radius: 12px; padding: 16px 22px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #eef0f5;">
            <div style="display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f5;">
                <span style="font-size: 11px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; min-width: 24px;">01</span>
                <span style="font-size: 13px; color: #5a5a6e;">CPI 超预期 → 加息强化 → PONY 跌破 $8.00 概率大增</span>
            </div>
            <div style="display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f5;">
                <span style="font-size: 11px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; min-width: 24px;">02</span>
                <span style="font-size: 13px; color: #5a5a6e;">TEM insider selling 若 SEC 证实 → 减仓至 5% 以下</span>
            </div>
            <div style="display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f5;">
                <span style="font-size: 11px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; min-width: 24px;">03</span>
                <span style="font-size: 13px; color: #5a5a6e;">小米跌破 26.00 无 Q2 利好 → 承压但不砍</span>
            </div>
            <div style="display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f5;">
                <span style="font-size: 11px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; min-width: 24px;">04</span>
                <span style="font-size: 13px; color: #5a5a6e;">VIX > 20 超 1 周 → 系统性风险升级，全面不加仓</span>
            </div>
            <div style="display: flex; gap: 10px; padding: 8px 0;">
                <span style="font-size: 11px; font-weight: 700; color: #e74c3c; font-family: 'Courier New', monospace; min-width: 24px;">05</span>
                <span style="font-size: 13px; color: #5a5a6e;">PONY 南向资金 3 日未净买入 → 港股通利好可能被高估</span>
            </div>
        </div>
    </div>

    <!-- 事件提醒 -->
    <div style="display: flex; gap: 10px; margin-bottom: 24px;">
        <div style="flex: 1; background: rgba(108,92,231,0.06); border: 1px solid rgba(108,92,231,0.15); border-radius: 12px; padding: 16px 18px;">
            <div style="font-size: 10px; font-weight: 700; color: #6c5ce7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;">6/11 · 3 天后</div>
            <div style="font-size: 13px; color: #4a4a5a;">美国 5 月 CPI · 成长股关键转折</div>
        </div>
        <div style="flex: 1; background: rgba(108,92,231,0.06); border: 1px solid rgba(108,92,231,0.15); border-radius: 12px; padding: 16px 18px;">
            <div style="font-size: 10px; font-weight: 700; color: #6c5ce7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;">6 月中旬</div>
            <div style="font-size: 13px; color: #4a4a5a;">Adobe Q2 财报 · 观察仓标的</div>
        </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; font-size: 10px; color: #b0b0c0; letter-spacing: 3px; text-transform: uppercase; padding-top: 16px; border-top: 1px solid #e0e3ea;">
        GENERATED BY 元气小虾 / OPENCLAW
    </div>
</div>
"""

# 渲染
doc = fitz.open()
page = doc.new_page(width=W, height=2400)

# 先画背景
page.draw_rect(fitz.Rect(0, 0, W, 2400), fill=(0.97, 0.97, 0.98))

# 品牌色带
page.draw_rect(fitz.Rect(0, 0, W, 4), fill=(0.424, 0.361, 0.906))

# 插入 HTML
rect = fitz.Rect(MARGIN, 0, W-MARGIN, 2400)
page.insert_htmlbox(rect, html)

# 输出
pix = page.get_pixmap(dpi=200)
pix.save("/tmp/daily_report_v8.png")
print(f"done: {pix.width}x{pix.height}")
