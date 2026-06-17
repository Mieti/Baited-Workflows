from collections.abc import Generator

from sqlalchemy.pool import NullPool
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings


engine = create_engine(settings.database_url, echo=False, poolclass=NullPool)


def init_db() -> None:
    import app.models.workflow  # noqa: F401

    SQLModel.metadata.create_all(engine)
    from app.services.blocks import seed_block_catalog

    with Session(engine) as session:
        seed_block_catalog(session)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
