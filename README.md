# Open-Q

**Open-Q** is an open-source platform for conducting **Q-methodology** research. It provides a seamless, modern interface for participants to perform Q-sorts and for researchers to collect and analyze subjective viewpoints.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![CI](https://github.com/jvastenaekels/open-q/actions/workflows/ci.yml/badge.svg)](https://github.com/jvastenaekels/open-q/actions/workflows/ci.yml)

---

## 📚 Documentation

The documentation is organized using the **Diátaxis** framework:

- **[Tutorials](docs/tutorials/)**: Learning-oriented lessons.
  - [Production Deployment](docs/guides/deployment.md) (Scalingo, Docker)
- **[Guides](docs/guides/)**: Task-oriented how-to guides.
  - [Admin Dashboard Features](docs/guides/admin-features.md)
  - [Admin & Team Management](docs/guides/admin-management.md)
  - [Conducting Studies](docs/guides/conducting-studies.md)
  - [Exporting Data](docs/guides/data-export.md)
  - [Contributing & Development](docs/guides/contributing/development.md)
- **[Reference](docs/reference/)**: Information-oriented reference.
  - [API Reference](docs/reference/api.md)
  - [Configuration Options](docs/reference/configuration.md)
  - [Frontend Components](docs/reference/components.md)
- **[Explanation](docs/explanation/)**: Understanding-oriented background.
  - [Architecture Overview](docs/explanation/architecture.md)
  - [Mobile UX Decisions](docs/explanation/design-decisions/mobile-ux.md)

---

## ✨ Features

- **Modern Q-Sort Interface** — Drag-and-drop with fluid animations (Framer Motion).
- **Two-Factor Authentication (TOTP)** — Enhanced security for researcher accounts.
- **Recruitment Analytics** — Track participant conversion (Starts vs. Submissions) and success rates.
- **Advanced RBAC** — Multi-user collaboration with Owner, Editor, and Viewer roles in Workspace isolation.
- **Administrative API** — Full management of users, studies, and cross-format data exports.
- **Modern Stack** — Built with **React 19**, **React Router v7** (Data APIs), and **FastAPI**.
- **Multi-language Support** — Fully internationalized (i18n) for global research.
- **Responsive Design** — "Focus Flow" UX optimized for mobile devices.
- **Flexible Configuration** — Define grid shapes, recruitment logic, and access passwords via API.
- **Gunicorn**: Robust WSGI server for production concurrency.
- **Local CI Wrapper**: A unified `make ci` command to verify code quality before pushing.

---

## 🚀 Quick Start

```bash
# Install everything
make install

# Run backend (FastAPI)
make run-backend

# Run frontend (React/Vite)
make run-frontend

# Run full CI check (Lint + Type + Security + Tests)
make ci
```

## 🚀 Quick Start (Development)

1. **Clone & Install**:

   ```bash
   git clone https://github.com/jvastenaekels/open-q.git
   cd open-q
   make install # (Requires Make) OR see docs/guides/contributing/development.md
   ```

2. **Run Locally**:

   ```bash
   make run
   ```

3. **Visit**: [http://localhost:5173/study/example-study/welcome](http://localhost:5173/study/example-study/welcome)

For detailed setup instructions, see the [Development Guide](docs/guides/contributing/development.md).

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.
