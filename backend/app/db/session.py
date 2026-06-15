from collections.abc import Generator

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings


engine = create_engine(settings.database_url, echo=False, pool_pre_ping=True)


def init_db() -> None:
    import app.models.workflow  # noqa: F401

    SQLModel.metadata.create_all(engine)
    drop_obsolete_graph_projection_tables()
    from app.services.blocks import seed_block_catalog

    with Session(engine) as session:
        seed_block_catalog(session)


def drop_obsolete_graph_projection_tables() -> None:
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS workflow_version_edges"))
        connection.execute(text("DROP TABLE IF EXISTS workflow_version_nodes"))


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
