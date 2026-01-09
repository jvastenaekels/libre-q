import asyncio
import logging
import sys
from sqlalchemy import text
from app.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def force_migrate():
    logger.info("Starting force migration for missing columns...")
    async with engine.connect() as conn:
        try:
            # studies.randomize_statements
            logger.info("checking studies.randomize_statements")
            try:
                await conn.execute(
                    text(
                        "ALTER TABLE studies ADD COLUMN randomize_statements BOOLEAN DEFAULT 0"
                    )
                )
                logger.info("Added randomize_statements")
            except Exception as e:
                logger.info(f"Skipping randomize_statements: {e}")

            # translations.methodology_tips
            logger.info("checking study_translations.methodology_tips")
            try:
                if conn.dialect.name == "postgresql":
                    await conn.execute(
                        text(
                            "ALTER TABLE study_translations ADD COLUMN methodology_tips JSON DEFAULT '[]'::json"
                        )
                    )
                else:
                    await conn.execute(
                        text(
                            "ALTER TABLE study_translations ADD COLUMN methodology_tips JSON DEFAULT '[]'"
                        )
                    )
                logger.info("Added methodology_tips")
            except Exception as e:
                logger.info(f"Skipping methodology_tips: {e}")

            # translations.step_help
            logger.info("checking study_translations.step_help")
            try:
                if conn.dialect.name == "postgresql":
                    await conn.execute(
                        text(
                            "ALTER TABLE study_translations ADD COLUMN step_help JSON DEFAULT '{}'::json"
                        )
                    )
                else:
                    await conn.execute(
                        text(
                            "ALTER TABLE study_translations ADD COLUMN step_help JSON DEFAULT '{}'"
                        )
                    )
                logger.info("Added step_help")
            except Exception as e:
                logger.info(f"Skipping step_help: {e}")

            # participants.random_seed
            logger.info("checking participants.random_seed")
            try:
                await conn.execute(
                    text("ALTER TABLE participants ADD COLUMN random_seed VARCHAR")
                )
                logger.info("Added random_seed")
            except Exception as e:
                logger.info(f"Skipping random_seed: {e}")

            await conn.commit()
            logger.info("Force migration completed.")
        except Exception as e:
            logger.error(f"Force migration failed: {e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(force_migrate())
