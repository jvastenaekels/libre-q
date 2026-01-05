postdeploy: cd backend && python3 scripts/migrate.py && python3 scripts/postdeploy.py
release: cd backend && python3 scripts/postdeploy.py
web: cd backend && gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --access-logfile - --error-logfile -
