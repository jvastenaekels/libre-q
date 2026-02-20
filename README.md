# Libre-Q

**Open-source platform for Q-methodology research.**

Design studies, collect Q-sorts, and run factor analysis from the browser. Supports any device, requires no software installation, and keeps data on your own server.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![CI](https://github.com/jvastenaekels/libre-q/actions/workflows/ci.yml/badge.svg)](https://github.com/jvastenaekels/libre-q/actions/workflows/ci.yml)

<!-- TODO: Add hero screenshot of the Q-sort grid interface -->

---

## Why Libre-Q?

| Capability | FlashQ / HTMLQ | PQMethod | Ken-Q | Libre-Q |
| :--- | :---: | :---: | :---: | :---: |
| Browser-based data collection | Yes | No | No | **Yes** |
| Mobile & tablet support | Limited | No | No | **Yes** |
| Built-in factor analysis | No | Yes | Yes | **Yes** |
| Enforced forced distribution | Partial | N/A | N/A | **Yes** |
| Multi-language studies | No | No | No | **Yes** |
| Audio post-sort responses | No | No | No | **Yes** |
| Recruitment tracking & funnels | No | No | No | **Yes** |
| Team collaboration (roles) | No | No | No | **Yes** |
| Export to PQMethod / R / Ken-Q | N/A | N/A | N/A | **Yes** |
| Self-hosted / data ownership | Partial | Desktop | No | **Yes** |
| Open source | Yes | No | No | **Yes** |

---

## Key Features

### Participant Experience

- **Clean, readable layout.** Simple interface that lets participants focus on the sorting task without unnecessary distractions.
- **Works on any device.** Smartphone, tablet, or desktop — participants open a link and start sorting. No apps or plugins required.
- **Mobile-first drag-and-drop.** Touch-optimized sorting with auto-pan, dwell-zoom, and edge scrolling, so participants without desktop access are not excluded.
- **Multi-language support.** Translate statements, instructions, consent forms, and UI labels. Participants see the study in their preferred language.


### Study Design

- **Visual grid designer** with symmetry lock, capacity validation, and configurable score ranges.
- **Survey builder** with 9 question types (text, number, select, radio, checkbox, date, email, textarea, audio), conditional visibility, reordering, and per-question validation.
- **Markdown-formatted content** for instructions, consent forms, and condition of instruction.
- **Import/Export configurations** to create templates, back up designs, or clone studies across workspaces.
- **Pilot mode** to run through the full participant experience without persisting any data.

### Analysis

- **Built-in factor analysis** — run initial exploration without exporting to external software.
- **PCA or Centroid extraction** (Brown 1980) with Varimax rotation and Kaiser normalization.
- **Scree plot** with Kaiser criterion reference line for factor selection.
- **Auto-flagging** using significance and dominance thresholds, or manual flagging for full researcher control.
- **Distinguishing & consensus statements** classified via Standard Error of Differences at multiple significance levels (p < 0.05, 0.01, 0.001).
- **Factor arrays, z-scores, composite reliability** (Spearman-Brown), and factor correlation matrix.

### Data Collection & Monitoring

- **Recruitment links** — public, single-use, or capacity-limited — with QR code generation and funnel tracking (started vs. completed).
- **Monitoring dashboard** with submission timelines, device breakdowns, and completion rates.
- **Session review** with grid reconstruction, survey responses, and audio playback.
- **Test run management** to separate pilot data from real submissions.
- **Discard with reason** to flag problematic responses while preserving the audit trail.

### Export & Interoperability

| Format | Description |
| :----- | :---------- |
| **CSV** | Wide-format, one row per participant. Compatible with Excel, SPSS, Stata. |
| **PQMethod** | `.dat` + `.sta` files ready for PQMethod and Ken-Q Analysis. |
| **Ken-Q JSON** | Native format for Ken-Q web analysis. |
| **R-Kit** | CSV + auto-generated R script using the `qmethod` package. |
| **Research Package** | ZIP with all formats, codebook, and metadata for archiving. |

### Privacy & Security

- **Self-hosted.** Data stays on your server with no third-party analytics or tracking.
- **IP address hashing.** Participant IPs are SHA-256 hashed with a configurable salt before storage — never stored in plaintext.
- **Consent audit trail.** Each participant's consent is recorded with a hash of the consent version they agreed to.
- **Security headers** (HSTS, CSP, X-Frame-Options) and bcrypt password hashing.
- **Two-factor authentication** (TOTP) for researcher accounts.
- **Role-based access control.** Workspace-level roles (Owner, Researcher, Viewer) control who can edit, export, or manage team members.

### Collaboration

- **Workspaces** to isolate research groups — each with its own members and studies.
- **Concurrent editing** with auto-save, optimistic locking, and conflict resolution.
- **Invitation system** via email, or shareable link when SMTP is not configured.

---

## Quick Start

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Node.js](https://nodejs.org/) v24+
- PostgreSQL 15+

### Install & Run

```bash
git clone https://github.com/jvastenaekels/libre-q.git
cd libre-q
make install

# Terminal 1 — Backend (FastAPI)
make run-backend

# Terminal 2 — Frontend (React/Vite)
make run-frontend
```

Visit [http://localhost:5173](http://localhost:5173) to open the app.

```bash
# Run the full CI pipeline locally (lint + type check + test + build)
make ci
```

### Deploy

Libre-Q deploys as a single application (FastAPI serves the built React frontend). See the [Deployment Guide](docs/guides/deployment.md) for Scalingo, Render, Heroku, and Docker instructions.

---

## Documentation

Organized using the [Diataxis framework](https://diataxis.fr/). See the [full index](docs/README.md).

| | |
| :--- | :--- |
| **[Tutorials](docs/tutorials/)** | [Your First Study](docs/tutorials/your-first-study.md) &middot; [Collecting Responses](docs/tutorials/collecting-responses.md) &middot; [Analyzing Results](docs/tutorials/analyzing-results.md) &middot; [Local Development](docs/tutorials/local-development.md) |
| **[Guides](docs/guides/)** | [Conducting Studies](docs/guides/conducting-studies.md) &middot; [Admin Features](docs/guides/admin-features.md) &middot; [Data Export](docs/guides/data-export.md) &middot; [Deployment](docs/guides/deployment.md) &middot; [S3 Audio Setup](docs/guides/s3-setup.md) |
| **[Reference](docs/reference/)** | [API](docs/reference/api.md) &middot; [Configuration](docs/reference/configuration.md) &middot; [Components](docs/reference/components.md) |
| **[Explanation](docs/explanation/)** | [Architecture](docs/explanation/architecture.md) &middot; [Q-Methodology](docs/explanation/q-methodology.md) &middot; [Mobile UX Decisions](docs/explanation/design-decisions/mobile-ux.md) |

---

## Tech Stack

| Layer | Technologies |
| :---- | :----------- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, dnd-kit, Zustand, TanStack Query, react-i18next |
| **Backend** | Python 3.13, FastAPI, SQLAlchemy (async), Pydantic, Alembic |
| **Database** | PostgreSQL 15+ |
| **Storage** | S3-compatible (AWS, MinIO, Cloudflare R2) for audio recordings |
| **Tooling** | uv, npm, Biome, Ruff, Vitest, Playwright |

---

## Contributing

Contributions are welcome. Please read the guidelines before submitting a PR:

- [Coding Standards](docs/contributing/coding-standards.md)
- [Frontend Guidelines](docs/contributing/frontend-guidelines.md)
- [Backend Guidelines](docs/contributing/backend-guidelines.md)
- [Development Setup](docs/guides/contributing/development.md)

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

Libre-Q is developed in the spirit of Open Science — providing a transparent, reproducible, and accessible tool for subjectivity research where data ownership remains with the researcher.
