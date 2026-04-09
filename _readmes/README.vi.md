<p align="center">
  <img src="../_statics/vbpclaw.png" alt="VBPClaw" />
</p>

<h1 align="center">VBPClaw</h1>

<p align="center"><strong>Enterprise AI Agent Platform</strong></p>

<p align="center">
Multi-agent AI gateway built in Go. 20+ LLM providers. 7 channels. Multi-tenant PostgreSQL.<br/>
Single binary. Production-tested. Agents that orchestrate for you.
</p>

<p align="center">
  <a href="https://docs.vbpclaw.sh">Tài liệu</a> •
  <a href="https://docs.vbpclaw.sh/#quick-start">Bắt đầu nhanh</a> •
  <a href="https://x.com/nlb_io">Twitter / X</a>
</p>

<p align="center">
  <a href="https://go.dev/"><img src="https://img.shields.io/badge/Go_1.26-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL_18-316192?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebSocket"><img src="https://img.shields.io/badge/WebSocket-010101?style=flat-square&logo=socket.io&logoColor=white" alt="WebSocket" /></a>
  <a href="https://opentelemetry.io/"><img src="https://img.shields.io/badge/OpenTelemetry-000000?style=flat-square&logo=opentelemetry&logoColor=white" alt="OpenTelemetry" /></a>
  <a href="https://www.anthropic.com/"><img src="https://img.shields.io/badge/Anthropic-191919?style=flat-square&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
  <a href="https://openai.com/"><img src="https://img.shields.io/badge/OpenAI_Compatible-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI" /></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License: MIT" />
</p>

**VBPClaw** là cổng AI đa agent, kết nối các LLM với công cụ, kênh giao tiếp và dữ liệu của bạn — triển khai dưới dạng một tệp nhị phân Go duy nhất, không phụ thuộc runtime. VBPClaw điều phối nhóm agent và ủy quyền giữa các agent trên hơn 20 nhà cung cấp LLM với multi-tenant isolation hoàn chỉnh.

Phiên bản Go của [OpenClaw](https://github.com/openclaw/openclaw) với bảo mật nâng cao, multi-tenant PostgreSQL, và observability cấp production.

🌐 **Ngôn ngữ:**
[🇺🇸 English](../README.md) ·
[🇨🇳 简体中文](README.zh-CN.md) ·
[🇯🇵 日本語](README.ja.md) ·
[🇰🇷 한국어](README.ko.md) ·
[🇻🇳 Tiếng Việt](README.vi.md) ·
[🇪🇸 Español](README.es.md) ·
[🇧🇷 Português](README.pt.md) ·
[🇫🇷 Français](README.fr.md) ·
[🇩🇪 Deutsch](README.de.md) ·
[🇷🇺 Русский](README.ru.md)
## Điểm Khác Biệt

- **Nhóm agent và điều phối** — Nhóm với bảng nhiệm vụ dùng chung, ủy quyền giữa các agent (đồng bộ/bất đồng bộ), và khám phá agent hỗn hợp
- **Multi-tenant PostgreSQL** — Không gian làm việc riêng theo người dùng, tệp ngữ cảnh riêng, khóa API được mã hóa (AES-256-GCM), session cô lập
- **Một tệp nhị phân duy nhất** — Tệp nhị phân Go tĩnh khoảng 25 MB, không cần runtime Node.js, khởi động dưới 1 giây, chạy được trên VPS $5 (khuyến nghị tối thiểu 2 GB RAM khi chạy Docker)
- **Bảo mật cấp production** — Hệ thống phân quyền 5 lớp (gateway auth → global tool policy → per-agent → per-channel → owner-only) cùng rate limiting, phát hiện prompt injection, chống SSRF, shell deny patterns, và mã hóa AES-256-GCM
- **Hơn 20 nhà cung cấp LLM** — Anthropic (HTTP+SSE gốc với prompt caching), OpenAI, OpenRouter, Groq, DeepSeek, Gemini, Mistral, xAI, MiniMax, Cohere, Perplexity, DashScope, Bailian, Zai, Ollama, Ollama Cloud, Claude CLI, Codex, ACP, và mọi OpenAI-compatible endpoint
- **7 kênh nhắn tin** — Telegram, Discord, Slack, Zalo OA, Zalo Personal, Feishu/Lark, WhatsApp
- **Extended Thinking** — Chế độ suy luận theo từng nhà cung cấp (budget token của Anthropic, reasoning effort của OpenAI, thinking budget của DashScope) với hỗ trợ streaming
- **Heartbeat** — Agent tự kiểm tra định kỳ qua danh sách HEARTBEAT.md với tắt thông báo khi bình thường, khung giờ hoạt động, cơ chế thử lại, và gửi kết quả qua kênh
- **Lập lịch và Cron** — Biểu thức `at`, `every`, và cron để tự động hóa nhiệm vụ agent với xử lý đồng thời theo lane
- **Observability** — Theo dõi lời gọi LLM tích hợp sẵn với span và chỉ số prompt cache, xuất OpenTelemetry OTLP tùy chọn

## Hệ Sinh Thái Claw

|                          | OpenClaw        | ZeroClaw | PicoClaw | **VBPClaw**                              |
| ------------------------ | --------------- | -------- | -------- | --------------------------------------- |
| Ngôn ngữ                 | TypeScript      | Rust     | Go       | **Go**                                  |
| Kích thước tệp nhị phân  | 28 MB + Node.js | 3,4 MB   | ~8 MB    | **~25 MB** (cơ bản) / **~36 MB** (+ OTel) |
| Docker image             | —               | —        | —        | **~50 MB** (Alpine)                     |
| RAM (khi nhàn rỗi)       | > 1 GB          | < 5 MB   | < 10 MB  | **~35 MB**                              |
| Thời gian khởi động      | > 5 s           | < 10 ms  | < 1 s    | **< 1 s**                               |
| Phần cứng mục tiêu       | Mac Mini $599+  | $10 edge | $10 edge | **VPS $5+**                             |

| Tính năng                            | OpenClaw                             | ZeroClaw                                     | PicoClaw                                    | **VBPClaw**                     |
| ------------------------------------ | ------------------------------------ | -------------------------------------------- | ------------------------------------------- | ------------------------------ |
| Multi-tenant (PostgreSQL)            | —                                    | —                                            | —                                           | ✅                             |
| Tích hợp MCP                        | — (dùng ACP)                         | —                                            | —                                           | ✅ (stdio/SSE/streamable-http) |
| Nhóm agent                          | —                                    | —                                            | —                                           | ✅ Bảng nhiệm vụ + hộp thư    |
| Tăng cường bảo mật                  | ✅ (SSRF, path traversal, injection) | ✅ (sandbox, rate limit, injection, pairing)  | Cơ bản (giới hạn workspace, từ chối exec)   | ✅ Phòng thủ 5 lớp            |
| Observability (OTel)                 | ✅ (phần mở rộng tùy chọn)          | ✅ (Prometheus + OTLP)                       | —                                           | ✅ OTLP (tùy chọn build tag)  |
| Prompt caching                      | —                                    | —                                            | —                                           | ✅ Anthropic + OpenAI-compat   |
| Knowledge graph                     | —                                    | —                                            | —                                           | ✅ Trích xuất LLM + duyệt đồ thị |
| Hệ thống skill                      | ✅ Embedding/semantic                | ✅ SKILL.md + TOML                           | ✅ Cơ bản                                   | ✅ BM25 + pgvector hybrid      |
| Bộ lập lịch theo lane               | ✅                                   | Đồng thời giới hạn                          | —                                           | ✅ (main/subagent/team/cron)   |
| Kênh nhắn tin                       | 37+                                  | 15+                                          | 10+                                         | 7+                             |
| Ứng dụng đồng hành                  | macOS, iOS, Android                  | Python SDK                                   | —                                           | Web dashboard                  |
| Live Canvas / Giọng nói             | ✅ (A2UI + TTS/STT)                  | —                                            | Voice transcription                         | TTS (4 nhà cung cấp)          |
| Nhà cung cấp LLM                    | 10+                                  | 8 gốc + 29 tương thích                      | 13+                                         | **20+**                        |
| Workspace theo người dùng           | ✅ (dựa trên tệp)                   | —                                            | —                                           | ✅ (PostgreSQL)                |
| Encrypted secrets                   | — (chỉ biến môi trường)             | ✅ ChaCha20-Poly1305                         | — (JSON không mã hóa)                      | ✅ AES-256-GCM trong CSDL     |

## Kiến Trúc

<p align="center">
  <img src="../_statics/architecture.jpg" alt="VBPClaw Architecture" width="800" />
</p>

## Bắt Đầu Nhanh

**Yêu cầu:** Go 1.26+, PostgreSQL 18 với pgvector, Docker (tùy chọn, khuyến nghị tối thiểu 2 GB RAM)

### Từ mã nguồn

```bash
git clone https://github.com/nextlevelbuilder/vbpclaw.git && cd vbpclaw
make build
./vbpclaw onboard        # Trình hướng dẫn cài đặt tương tác
source .env.local && ./vbpclaw
```

### Với Docker

```bash
# Tạo .env với các secret được sinh tự động
chmod +x prepare-env.sh && ./prepare-env.sh

# Thêm ít nhất một VBPCLAW_*_API_KEY vào .env, sau đó:
make up

# Web Dashboard tại http://localhost:18790
# Kiểm tra trạng thái: curl http://localhost:18790/health
```

Khi biến môi trường `VBPCLAW_*_API_KEY` được đặt, gateway tự động thiết lập mà không cần tương tác — nhận diện nhà cung cấp, chạy database migration, và khởi tạo dữ liệu mặc định.

> Để tìm hiểu về các biến thể build (OTel, Tailscale, Redis), Docker image tag, và compose overlay, xem [Hướng dẫn triển khai](https://docs.vbpclaw.sh/#deploy-docker-compose).

## Điều Phối Đa Agent

VBPClaw hỗ trợ nhóm agent và ủy quyền giữa các agent — mỗi agent chạy với danh tính, bộ công cụ, nhà cung cấp LLM, và tệp ngữ cảnh riêng.

### Ủy Quyền Giữa Các Agent

<p align="center">
  <img src="../_statics/agent-delegation.jpg" alt="Agent Delegation" width="700" />
</p>

| Chế độ | Cách hoạt động | Phù hợp cho |
|------|-------------|----------|
| **Đồng bộ** | Agent A hỏi Agent B và **chờ** kết quả | Tra cứu nhanh, kiểm chứng thông tin |
| **Bất đồng bộ** | Agent A hỏi Agent B và **tiếp tục**. B thông báo sau | Nhiệm vụ dài, báo cáo, phân tích chuyên sâu |

Các agent giao tiếp qua **permission link** với kiểm soát chiều (`outbound`, `inbound`, `bidirectional`) và giới hạn đồng thời ở cả cấp liên kết và cấp agent.

### Nhóm Agent

<p align="center">
  <img src="../_statics/agent-teams.jpg" alt="Agent Teams Workflow" width="800" />
</p>

- **Bảng nhiệm vụ dùng chung** — Tạo, nhận, hoàn thành, tìm kiếm nhiệm vụ với phụ thuộc `blocked_by`
- **Hộp thư nhóm** — Nhắn tin trực tiếp ngang hàng và thông báo chung
- **Công cụ**: `team_tasks` để quản lý nhiệm vụ, `team_message` cho hộp thư

> Chi tiết về ủy quyền, permission link, và kiểm soát đồng thời xem tại [tài liệu Nhóm Agent](https://docs.vbpclaw.sh/#teams-what-are-teams).

## Công Cụ Tích Hợp Sẵn

| Công cụ            | Nhóm          | Mô tả                                                            |
| ------------------ | ------------- | ----------------------------------------------------------------- |
| `read_file`        | fs            | Đọc nội dung tệp (với định tuyến hệ thống tệp ảo)               |
| `write_file`       | fs            | Ghi/tạo tệp                                                      |
| `edit_file`        | fs            | Áp dụng chỉnh sửa có mục tiêu vào tệp hiện có                   |
| `list_files`       | fs            | Liệt kê nội dung thư mục                                         |
| `search`           | fs            | Tìm kiếm nội dung tệp theo mẫu                                  |
| `glob`             | fs            | Tìm tệp theo mẫu glob                                           |
| `exec`             | runtime       | Thực thi lệnh shell (với quy trình phê duyệt)                   |
| `web_search`       | web           | Tìm kiếm trên web (Brave, DuckDuckGo)                            |
| `web_fetch`        | web           | Tải và phân tích nội dung web                                     |
| `memory_search`    | memory        | Tìm kiếm bộ nhớ dài hạn (FTS + vector)                           |
| `memory_get`       | memory        | Truy xuất mục bộ nhớ                                              |
| `skill_search`     | —             | Tìm kiếm skill (BM25 + embedding hybrid)                         |
| `knowledge_graph_search` | memory  | Tìm kiếm thực thể và duyệt quan hệ knowledge graph              |
| `create_image`     | media         | Tạo ảnh (DashScope, MiniMax)                                     |
| `create_audio`     | media         | Tạo âm thanh (OpenAI, ElevenLabs, MiniMax, Suno)                |
| `create_video`     | media         | Tạo video (MiniMax, Veo)                                        |
| `read_document`    | media         | Đọc tài liệu (Gemini File API, chuỗi nhà cung cấp)             |
| `read_image`       | media         | Phân tích ảnh                                                    |
| `read_audio`       | media         | Phiên âm và phân tích âm thanh                                  |
| `read_video`       | media         | Phân tích video                                                  |
| `message`          | messaging     | Gửi tin nhắn đến kênh                                            |
| `tts`              | —             | Tổng hợp giọng nói                                               |
| `spawn`            | —             | Tạo subagent                                                     |
| `subagents`        | sessions      | Quản lý các subagent đang chạy                                   |
| `team_tasks`       | teams         | Bảng nhiệm vụ dùng chung (liệt kê, tạo, nhận, hoàn thành, tìm) |
| `team_message`     | teams         | Hộp thư nhóm (gửi, thông báo chung, đọc)                        |
| `sessions_list`    | sessions      | Liệt kê các session đang hoạt động                               |
| `sessions_history` | sessions      | Xem lịch sử session                                              |
| `sessions_send`    | sessions      | Gửi tin nhắn đến session                                         |
| `sessions_spawn`   | sessions      | Tạo session mới                                                  |
| `session_status`   | sessions      | Kiểm tra trạng thái session                                      |
| `cron`             | automation    | Lập lịch và quản lý tác vụ định kỳ                               |
| `gateway`          | automation    | Quản trị gateway                                                 |
| `browser`          | ui            | Tự động hóa trình duyệt (điều hướng, nhấp, gõ, chụp màn hình)  |
| `announce_queue`   | automation    | Thông báo kết quả bất đồng bộ (cho các ủy quyền bất đồng bộ)   |

## Tài Liệu

Tài liệu đầy đủ tại **[docs.vbpclaw.sh](https://docs.vbpclaw.sh)** — hoặc xem mã nguồn trong [`vbpclaw-docs/`](https://github.com/nextlevelbuilder/vbpclaw-docs)

| Mục | Chủ đề |
|---------|--------|
| [Bắt đầu](https://docs.vbpclaw.sh/#what-is-vbpclaw) | Cài đặt, Bắt đầu nhanh, Cấu hình, Tham quan Web Dashboard |
| [Khái niệm cốt lõi](https://docs.vbpclaw.sh/#how-vbpclaw-works) | Agent Loop, Session, Công cụ, Bộ nhớ, Multi-Tenancy |
| [Agent](https://docs.vbpclaw.sh/#creating-agents) | Tạo agent, Tệp ngữ cảnh, Tính cách, Chia sẻ và quyền truy cập |
| [Nhà cung cấp](https://docs.vbpclaw.sh/#providers-overview) | Anthropic, OpenAI, OpenRouter, Gemini, DeepSeek, và hơn 15 nhà cung cấp khác |
| [Kênh](https://docs.vbpclaw.sh/#channels-overview) | Telegram, Discord, Slack, Feishu, Zalo, WhatsApp, WebSocket |
| [Nhóm Agent](https://docs.vbpclaw.sh/#teams-what-are-teams) | Nhóm, Bảng nhiệm vụ, Nhắn tin, Ủy quyền và chuyển giao |
| [Nâng cao](https://docs.vbpclaw.sh/#custom-tools) | Công cụ tùy chỉnh, MCP, Skill, Cron, Sandbox, Hooks, RBAC |
| [Triển khai](https://docs.vbpclaw.sh/#deploy-docker-compose) | Docker Compose, Cơ sở dữ liệu, Bảo mật, Observability, Tailscale |
| [Tham chiếu](https://docs.vbpclaw.sh/#cli-commands) | Lệnh CLI, REST API, WebSocket Protocol, Biến môi trường |

## Kiểm Thử

```bash
go test ./...                                    # Kiểm thử đơn vị
go test -v ./tests/integration/ -timeout 120s    # Kiểm thử tích hợp (yêu cầu gateway đang chạy)
```

## Trạng Thái Dự Án

Xem [CHANGELOG.md](CHANGELOG.md) để biết chi tiết trạng thái tính năng — những gì đã được kiểm thử trong môi trường production và những gì vẫn đang phát triển.

## Lời Cảm Ơn

VBPClaw được xây dựng dựa trên dự án [OpenClaw](https://github.com/openclaw/openclaw) gốc. Chúng tôi trân trọng kiến trúc và tầm nhìn đã truyền cảm hứng cho phiên bản Go này.

## Giấy Phép

MIT
