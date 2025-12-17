from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import submissions

app = FastAPI()

# CORS configuration
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(submissions.router, prefix="/api", tags=["submissions"])

@app.get("/")
def read_root():
    return {"Hello": "World"}
