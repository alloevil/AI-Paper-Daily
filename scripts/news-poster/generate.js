const satori = require('satori').default;
const sharp = require('sharp');
const fs = require('fs');

// 读取字体
const fontData = fs.readFileSync('./noto-sc.ttf');

// 今天的新闻数据（硬编码示例）
const news = [
  { category: '宏观', title: '特朗普宣布对华加征104%关税，贸易战升级', en: 'Trump announces 104% tariffs on China, trade war escalates' },
  { category: '宏观', title: '中国对美商品加征84%关税反击', en: 'China retaliates with 84% tariffs on US goods' },
  { category: '供应链', title: '台积电获66亿美元补贴赴美建厂', en: 'TSMC gets $6.6B subsidy for US fab' },
  { category: '供应链', title: '三星电子获60亿美元芯片补贴', en: 'Samsung Electronics gets $6B chip subsidy' },
  { category: '芯片', title: '英伟达H20芯片中国特供版曝光', en: 'Nvidia H20 China-specific chip exposed' },
  { category: '芯片', title: 'AMD中国区裁员消息不实', en: 'AMD China layoffs report denied' },
  { category: '竞品', title: 'OPPO Find X8 Ultra 影像旗舰发布', en: 'OPPO Find X8 Ultra imaging flagship launched' },
  { category: '竞品', title: 'vivo X200s 曝采用天玑9400+芯片', en: 'vivo X200s to use Dimensity 9400+' },
  { category: '出海', title: '小米欧洲市场Q4出货量增长35%', en: 'Xiaomi Q4 Europe shipments up 35%' },
  { category: '消费', title: 'iPhone 16e 销量不及预期', en: 'iPhone 16e sales below expectations' },
  { category: '消费', title: 'Switch 2 发布会定档4月2日', en: 'Switch 2 launch event set for April 2' },
];

// 构建报纸布局
function buildNewspaperLayout() {
  const leftColumn = [];
  const rightColumn = [];
  
  news.forEach((item, i) => {
    const col = i % 2 === 0 ? leftColumn : rightColumn;
    col.push(item);
  });

  return { leftColumn, rightColumn };
}

const { leftColumn, rightColumn } = buildNewspaperLayout();

// 生成单个新闻项的 JSX 结构
function renderNewsItem(item, index) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderLeft: '3px solid #8B4513',
        borderRadius: '0 8px 8px 0',
      },
      children: [
        {
          type: 'span',
          props: {
            style: {
              fontSize: '10px',
              color: '#666',
              fontFamily: 'Noto Sans SC',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            },
            children: item.category,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '14px',
              fontWeight: '600',
              color: '#1a1a1a',
              lineHeight: '1.4',
              fontFamily: 'Noto Sans SC',
            },
            children: item.title,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: '11px',
              color: '#555',
              fontStyle: 'italic',
              lineHeight: '1.3',
              fontFamily: 'Noto Sans SC',
            },
            children: item.en,
          },
        },
      ],
    },
  };
}

// 主 JSX 结构
const jsx = {
  type: 'div',
  props: {
    style: {
      width: '800px',
      height: '1000px',
      backgroundColor: '#f5f0e6',
      backgroundImage: 'radial-gradient(ellipse at top, #faf8f3 0%, #e8e0d0 100%)',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px',
      fontFamily: 'Noto Sans SC',
    },
    children: [
      // 报纸头
      {
        type: 'div',
        props: {
          style: {
            textAlign: 'center',
            borderBottom: '4px solid #2c1810',
            paddingBottom: '20px',
            marginBottom: '30px',
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  fontSize: '48px',
                  fontWeight: '900',
                  color: '#1a0f0a',
                  letterSpacing: '8px',
                  fontFamily: 'Noto Sans SC',
                  textTransform: 'uppercase',
                },
                children: 'The Daily Prophet',
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: '14px',
                  color: '#5a4a3a',
                  marginTop: '8px',
                  fontFamily: 'Noto Sans SC',
                },
                children: '每日科技情报 · 2026年3月31日 · 星期一',
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: '12px',
                  color: '#8a7a6a',
                  marginTop: '4px',
                  fontFamily: 'Noto Sans SC',
                },
                children: 'Xiaomi Internal · Confidential',
              },
            },
          ],
        },
      },
      // 分类标签
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          },
          children: [
            { category: '宏观', color: '#8B0000' },
            { category: '供应链', color: '#1E3A5F' },
            { category: '芯片', color: '#2F4F4F' },
            { category: '竞品', color: '#4A3728' },
            { category: '出海', color: '#006400' },
            { category: '消费', color: '#4B0082' },
          ].map((tag) => ({
            type: 'span',
            props: {
              style: {
                padding: '4px 12px',
                backgroundColor: tag.color,
                color: '#fff',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '4px',
                fontFamily: 'Noto Sans SC',
              },
              children: tag.category,
            },
          })),
        },
      },
      // 双栏内容
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            gap: '30px',
            flex: 1,
          },
          children: [
            // 左栏
            {
              type: 'div',
              props: {
                style: {
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                },
                children: leftColumn.map((item, i) => renderNewsItem(item, i * 2)),
              },
            },
            // 右栏
            {
              type: 'div',
              props: {
                style: {
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                },
                children: rightColumn.map((item, i) => renderNewsItem(item, i * 2 + 1)),
              },
            },
          ],
        },
      },
      // 底部
      {
        type: 'div',
        props: {
          style: {
            marginTop: 'auto',
            paddingTop: '20px',
            borderTop: '2px solid #d4c8b0',
            textAlign: 'center',
            color: '#8a7a6a',
            fontSize: '11px',
            fontFamily: 'Noto Sans SC',
          },
          children: 'Generated by pretext-term · Powered by MiniMax-M2.5',
        },
      },
    ],
  },
};

async function generate() {
  console.log('Generating newspaper poster...');
  
  const svg = await satori(jsx, {
    width: 800,
    height: 1000,
    fonts: [
      {
        name: 'Noto Sans SC',
        data: fontData,
        weight: 400,
        style: 'normal',
      },
    ],
  });

  // SVG → PNG
  await sharp(Buffer.from(svg))
    .png()
    .toFile('./daily-prophet.png');

  console.log('Done! Output: ./daily-prophet.png');
}

generate().catch(console.error);
