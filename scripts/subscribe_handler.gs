// AI Paper Daily - Google Apps Script Web App(订阅端点)
// 功能：
//   1. doPost: 接收站点订阅表单(docs/template.html handleSubscribe),
//      写入 Google Sheet,发送确认邮件
//   2. doGet: 返回订阅者列表 JSON
//   3. 每次新增订阅后,自动同步到 GitHub 的 data/subscribers.txt
//      (scripts/notifier.py 的邮件通道从那里取收件人)
//
// 部署（一次性,见 README「Subscribe without forking」节）：
//   1. 新建 Google Sheet,把它的 ID 填到 SHEET_ID
//   2. script.google.com 新建项目,粘贴本文件
//   3. 项目设置 → 脚本属性 添加 GITHUB_TOKEN(repo contents 写权限)
//   4. 部署 → 新建部署 → Web 应用,访问权限选「任何人」
//   5. 把部署 URL(/macros/s/<ID>/exec)填回 docs/template.html 的 GAS_ENDPOINT

// ========== 配置 ==========
// 注意：不要把真实 token 写进这里并提交到 git。
// 在 Apps Script 控制台用 PropertiesService 存储敏感值：
//   项目设置 → 脚本属性 添加 GITHUB_TOKEN
var SHEET_ID = 'REPLACE_WITH_GOOGLE_SHEET_ID';
var GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
var GITHUB_REPO = 'alloevil/AI-Paper-Daily';
var SUBSCRIBERS_PATH = 'data/subscribers.txt';
var SITE_URL = 'https://alloevil.github.io/AI-Paper-Daily/';
// ===========================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var email = data.email;
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return jsonResponse({error: 'Invalid email'});
    }

    var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    var rows = sheet.getDataRange().getValues();

    // 检查是否已订阅
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === email) {
        return jsonResponse({status: 'already_subscribed'});
      }
    }

    // 写入 Sheet
    sheet.appendRow([email, new Date().toISOString()]);

    // 同步到 GitHub data/subscribers.txt
    var syncResult = syncToGitHub(email);

    // 发送确认邮件
    sendConfirmEmail(email);

    return jsonResponse({status: 'ok', sync: syncResult});
  } catch (err) {
    return jsonResponse({error: err.message});
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    var rows = sheet.getDataRange().getValues();
    var emails = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        emails.push(rows[i][0]);
      }
    }
    return jsonResponse({subscribers: emails});
  } catch (err) {
    return jsonResponse({error: err.message});
  }
}

function sendConfirmEmail(email) {
  try {
    MailApp.sendEmail({
      to: email,
      subject: '✅ AI Paper Daily — 订阅成功',
      htmlBody: '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<meta name="color-scheme" content="light dark">' +
        '<meta name="supported-color-schemes" content="light dark">' +
        '</head>' +
        '<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">' +
        '<div style="max-width:600px;margin:0 auto;padding:40px 20px;">' +
        '<div style="text-align:center;margin-bottom:32px;">' +
        '<div style="font-size:32px;margin-bottom:8px;">📄</div>' +
        '<h1 style="margin:0;font-size:24px;font-weight:700;color:#1a1a2e;">AI Paper Daily</h1>' +
        '<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Daily AI Paper Discovery · Agent / RAG / Knowledge Graph</p>' +
        '</div>' +
        '<div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">' +
        '<h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1a1a2e;">欢迎订阅！🎉</h2>' +
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">感谢订阅 <strong>AI Paper Daily</strong>。之后每天你会收到一封论文精选邮件：arXiv + HuggingFace 双源采集,LLM 语义筛选出 Agent / RAG / 知识图谱方向的高相关论文。</p>' +
        '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">每周一还有按热度重排的论文周报 Top 15。</p>' +
        '<div style="text-align:center;">' +
        '<a href="' + SITE_URL + '" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">查看今日论文 →</a>' +
        '</div>' +
        '</div>' +
        '<div style="text-align:center;margin-top:24px;">' +
        '<p style="margin:0;font-size:12px;color:#9ca3af;">退订：直接回复本邮件并注明 "unsubscribe"。</p>' +
        '<p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">' +
        '<a href="https://github.com/alloevil/AI-Paper-Daily" style="color:#6b7280;text-decoration:none;">GitHub</a> · ' +
        '<a href="' + SITE_URL + '" style="color:#6b7280;text-decoration:none;">Website</a> · ' +
        '<a href="' + SITE_URL + 'feed.xml" style="color:#6b7280;text-decoration:none;">RSS</a>' +
        '</p>' +
        '</div>' +
        '</div>' +
        '</body>' +
        '</html>',
      noReply: true
    });
    Logger.log('✅ Confirmation email sent to: ' + email);
  } catch (err) {
    Logger.log('❌ Email send failed: ' + err.message);
  }
}


function syncToGitHub(newEmail) {
  try {
    var url = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + SUBSCRIBERS_PATH;
    var tokenHeader = 'Bearer ' + GITHUB_TOKEN;
    var resp = UrlFetchApp.fetch(url, {
      headers: {'Authorization': tokenHeader, 'User-Agent': 'AI-Paper-Daily'},
      muteHttpExceptions: true
    });

    var result = {getStatus: resp.getResponseCode()};

    if (resp.getResponseCode() !== 200) {
      result.getError = resp.getContentText().substring(0, 300);
      return result;
    }

    var file = JSON.parse(resp.getContentText());
    var sha = file.sha;
    var content = Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString();
    content = content.trim() + '\n' + newEmail + '\n';
    var encoded = Utilities.base64Encode(content);

    var putResp = UrlFetchApp.fetch(url, {
      method: 'put',
      contentType: 'application/json',
      headers: {'Authorization': tokenHeader, 'User-Agent': 'AI-Paper-Daily'},
      payload: JSON.stringify({
        message: '📧 New subscriber: ' + newEmail,
        content: encoded,
        sha: sha
      }),
      muteHttpExceptions: true
    });

    result.putStatus = putResp.getResponseCode();
    result.putBody = putResp.getContentText().substring(0, 300);
    return result;

  } catch (err) {
    return {error: err.message};
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
