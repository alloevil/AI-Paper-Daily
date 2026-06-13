#!/usr/bin/env python3
"""Mify 多模态快速调用 - 支持图片/视频/音频"""
import base64, json, urllib.request, sys, os, mimetypes

API_KEY = os.environ.get("LLM_API_KEY", "mit-VpJcWMSLf6VGBWlFSQgJfJ3YShbd6rq1XmiFCk660LSCVeVu")
BASE_URL = "http://model.mify.ai.srv/v1/chat/completions"

def detect_media_type(file_path):
    mime, _ = mimetypes.guess_type(file_path)
    if mime:
        if mime.startswith("image/"):
            return "image", mime
        elif mime.startswith("video/"):
            return "video", mime
        elif mime.startswith("audio/"):
            return "audio", mime
    return None, None

def encode_file(file_path):
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def build_content(file_path, text="描述这个内容", url=None):
    media_type, mime = detect_media_type(file_path) if file_path else ("image", "image/jpeg")
    
    if media_type == "image":
        if url:
            img_part = {"type": "image_url", "image_url": {"url": url}}
        else:
            b64 = encode_file(file_path)
            img_part = {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
        return [img_part, {"type": "text", "text": text}]
    
    elif media_type == "video":
        if url:
            vid_part = {"type": "video_url", "video_url": {"url": url}, "fps": 2, "media_resolution": "default"}
        else:
            b64 = encode_file(file_path)
            vid_part = {"type": "video_url", "video_url": {"url": f"data:{mime};base64,{b64}"}, "fps": 2, "media_resolution": "default"}
        return [vid_part, {"type": "text", "text": text}]
    
    elif media_type == "audio":
        if url:
            aud_part = {"type": "input_audio", "input_audio": {"data": url}}
        else:
            b64 = encode_file(file_path)
            aud_part = {"type": "input_audio", "input_audio": {"data": f"data:{mime};base64,{b64}"}}
        return [aud_part, {"type": "text", "text": text}]
    
    else:
        raise ValueError(f"不支持的媒体类型: {file_path}")

def multimodal_chat(model, file_path, text="描述这个内容", url=None):
    content = build_content(file_path, text, url)
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_completion_tokens": 2048
    }
    req = urllib.request.Request(
        BASE_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
    )
    resp = urllib.request.urlopen(req, timeout=180)
    return json.loads(resp.read())["choices"][0]["message"]["content"]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python3 multimodal.py <文件路径> [提示词] [模型]")
        print("示例: python3 multimodal.py photo.jpg '描述这张图' xiaomi/mimo-v2.5")
        sys.exit(1)
    
    file_path = sys.argv[1]
    text = sys.argv[2] if len(sys.argv) > 2 else "描述这个内容"
    model = sys.argv[3] if len(sys.argv) > 3 else "xiaomi/mimo-v2.5"
    
    result = multimodal_chat(model, file_path, text)
    print(result)
