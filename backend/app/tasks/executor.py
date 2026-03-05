"""In-process background task executor.

Replaces Huey SqliteHuey with a ThreadPoolExecutor that runs
inside the FastAPI process. Tasks are plain functions submitted
to the pool.
"""

import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Module-level executor instance
_executor: ThreadPoolExecutor | None = None


def init_executor(max_workers: int = 3) -> None:
    """Initialize the thread pool. Called from FastAPI lifespan startup."""
    global _executor
    if _executor is not None:
        logger.warning("Executor already initialized")
        return
    _executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="task")
    logger.info("Task executor initialized with %d workers", max_workers)


def shutdown_executor() -> None:
    """Shut down the thread pool gracefully. Called from FastAPI lifespan shutdown."""
    global _executor
    if _executor is None:
        return
    logger.info("Shutting down task executor...")
    _executor.shutdown(wait=True, cancel_futures=False)
    _executor = None
    logger.info("Task executor shut down")


def get_executor() -> ThreadPoolExecutor:
    """Get the executor instance. Raises if not initialized."""
    if _executor is None:
        raise RuntimeError("Task executor not initialized. Call init_executor() first.")
    return _executor


def submit_task(
    fn: Callable,
    *args: Any,
    retries: int = 0,
    retry_delay: float = 60.0,
    on_success: Callable[[Any], None] | None = None,
    task_name: str | None = None,
) -> str:
    """Submit a task to the background executor with retry and chaining support.

    Args:
        fn: The task function to run.
        *args: Positional arguments for fn.
        retries: Number of retry attempts on failure.
        retry_delay: Seconds to sleep between retries.
        on_success: Optional callback invoked with fn's return value on success.
                    Used for task chaining (e.g., download -> transcribe).
        task_name: Optional human-readable name for logging.

    Returns:
        A string task ID (UUID) for tracking purposes.
    """
    executor = get_executor()
    task_id = str(uuid.uuid4())
    name = task_name or f"{fn.__module__}.{fn.__name__}"

    def _run_with_retries():
        last_exception = None
        for attempt in range(1 + retries):
            try:
                if attempt > 0:
                    logger.info(
                        "Task %s [%s] retry %d/%d after %.0fs",
                        name, task_id, attempt, retries, retry_delay,
                    )
                    time.sleep(retry_delay)
                result = fn(*args)
                logger.info("Task %s [%s] completed successfully", name, task_id)
                if on_success is not None:
                    on_success(result)
                return result
            except Exception as e:
                last_exception = e
                logger.warning(
                    "Task %s [%s] attempt %d/%d failed: %s",
                    name, task_id, attempt + 1, 1 + retries, e,
                )
        # All retries exhausted
        logger.error(
            "Task %s [%s] failed after %d attempts: %s",
            name, task_id, 1 + retries, last_exception,
        )

    executor.submit(_run_with_retries)
    logger.info("Task %s [%s] submitted", name, task_id)
    return task_id
