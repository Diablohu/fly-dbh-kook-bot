# FLY-DBH Kook Bot

## 环境变量

-   **本地开发**：环境变量存储在项目根目录的 `.env` 文件中。该文件不会上传到 _Git_。
-   **生产环境**：自行设置系统的环境变量。

**使用的环境变量**

| 变量名          | 值                                  |
| --------------- | ----------------------------------- |
| KOOK_TOKEN      | Kook bot token                      |
| KOOK_TOKEN_FILE | Kook bot token (Docker secret file) |
| AVWX_TOKEN      | AVWX token                          |
| AVWX_TOKEN_FILE | AVWX token (Docker secret file)     |

-   `AVWX` 为当前使用的 _METAR_ 查询服务。

## 当前能力

-   ✅ 向 Kook DBH 服务器发送消息
-   ✅ 以 WebSocket 方式登录 Kook，并响应所有消息
-   ✅ 响应命令
    -   `/help`
    -   `/metar [ICAO]`
