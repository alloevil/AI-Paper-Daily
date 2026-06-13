# zsh-setup

> 容器内 zsh + Oh My Zsh 一键配置。解决 OpenClaw 容器默认 shell 不是 zsh 的问题。

## 适用场景

- 用户说"配置 zsh"、"安装 oh-my-zsh"、"默认 shell 改成 zsh"
- 容器内 Web Terminal 进来是 bash/sh，不是 zsh
- zsh 主题乱码（powerlevel10k 在 Web Terminal 渲染失败）

## 前置条件

- 容器内有 root 权限（sudo 或直接 root）
- 已安装 zsh（`/usr/bin/zsh` 存在）

## 执行流程

```
检查 zsh 是否安装
    │
    ├── 未安装 → apt-get install -y zsh
    │
    ▼
检查 Oh My Zsh 是否安装
    │
    ├── 未安装 → sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
    │
    ▼
修改 /etc/passwd 默认 shell
    │
    ├── root:x:0:0:root:/root:/bin/bash → root:x:0:0:root:/root:/usr/bin/zsh
    │
    ▼
~/.bashrc 末尾加自动切换
    │
    └── [[ -z "$ZSH_VERSION" && -x /usr/bin/zsh ]] && exec /usr/bin/zsh
    │
    ▼
检查主题兼容性
    │
    ├── powerlevel10k → 改为 robbyrussell（Web Terminal 兼容）
    │
    ▼
检查 HOME 变量
    │
    ├── export HOME=/home/node → 注释掉（否则 zsh 找不到 .zshrc）
    │
    ▼
验证
```

## 详细步骤

### 1. 安装 zsh

```bash
# 检查是否已安装
which zsh || apt-get update && apt-get install -y zsh
```

### 2. 安装 Oh My Zsh

```bash
# 检查是否已安装
[ -d "$HOME/.oh-my-zsh" ] || sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
```

### 3. 修改默认 shell

```bash
# 修改 /etc/passwd 中 root 的 shell
sudo sed -i 's|root:x:0:0:root:/root:/bin/bash|root:x:0:0:root:/root:/usr/bin/zsh|' /etc/passwd
```

### 4. ~/.bashrc 末尾加自动切换

```bash
echo '[[ -z "$ZSH_VERSION" && -x /usr/bin/zsh ]] && exec /usr/bin/zsh' >> ~/.bashrc
```

**原理**：OpenClaw Web Terminal 用 bash 进入容器，读 `~/.bashrc` 时自动 `exec zsh`。

### 5. 主题兼容性处理

```bash
# powerlevel10k 在 Web Terminal 里渲染成乱码（显示 10#）
# 改为 robbyrussell（简洁的 ➜ ~ 提示符）
sudo sed -i 's/ZSH_THEME="powerlevel10k\/powerlevel10k"/ZSH_THEME="robbyrussell"/' ~/.zshrc
```

**Web Terminal 兼容主题**：
- ✅ `robbyrussell` — 默认主题，简洁
- ✅ `agnoster` — 需要 Powerline 字体，Web Terminal 可能不支持
- ❌ `powerlevel10k` — 需要特殊字体，Web Terminal 乱码

### 6. HOME 变量检查

```bash
# 如果 bashrc 或 zshrc 里有 export HOME=/home/node，必须注释掉
# 否则 exec zsh 后 zsh 去找 /home/node/.zshrc（不存在），Oh My Zsh 不加载
sudo sed -i 's|export HOME=/home/node|# export HOME=/home/node  # 已禁用：会导致 zsh 找不到 .zshrc|' ~/.bashrc
sudo sed -i 's|export HOME=/home/node|# export HOME=/home/node  # 已禁用：会导致 zsh 找不到 .zshrc|' ~/.zshrc
```

### 7. 验证

```bash
# 检查 /etc/passwd
grep root /etc/passwd
# 应该显示: root:x:0:0:root:/root:/usr/bin/zsh

# 检查 ~/.bashrc 末尾
tail -3 ~/.bashrc
# 应该有: [[ -z "$ZSH_VERSION" && -x /usr/bin/zsh ]] && exec /usr/bin/zsh

# 检查主题
grep ZSH_THEME ~/.zshrc
# 应该显示: ZSH_THEME="robbyrussell"

# 检查 HOME
grep "HOME=/home/node" ~/.bashrc ~/.zshrc
# 应该都是注释状态
```

## 常见问题

### Web Terminal 进来还是 bash

**原因**：`~/.bashrc` 末尾没加自动切换，或 `export HOME=/home/node` 导致读错文件。

**解决**：检查 `~/.bashrc` 末尾是否有 `exec zsh`，检查 HOME 是否为 `/root`。

### zsh 提示符显示乱码（10#）

**原因**：powerlevel10k 主题需要特殊字体，Web Terminal 不支持。

**解决**：`sudo sed -i 's/ZSH_THEME="powerlevel10k\/powerlevel10k"/ZSH_THEME="robbyrussell"/' ~/.zshrc`

### Oh My Zsh 插件没加载

**原因**：`~/.zshrc` 中 `plugins=()` 没有需要的插件。

**解决**：编辑 `~/.zshrc`，在 `plugins=()` 中添加需要的插件，如 `plugins=(git zsh-autosuggestions zsh-syntax-highlighting)`。

### sudo 报 "unable to resolve host"

**原因**：`/etc/hosts` 中没有容器 hostname 的映射。

**解决**：不影响功能，忽略。或 `echo "127.0.0.1 $(hostname)" | sudo tee -a /etc/hosts`（注意 `/etc/hosts` 可能是只读的）。

### sandbox 中无法写 ~/.bashrc

**原因**：OpenClaw exec 工具以 `node` 用户（uid=1000）运行，`~/.bashrc` 是 root 的文件。

**解决**：用 `sudo` 写入，或从 Web Terminal（root 用户）手动执行。
