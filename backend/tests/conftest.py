import pytest
from app.database import init_db
from app.data.synthetic_generator import initialize_demo_data_if_needed

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Ensure database and demo datasets are initialized before tests run."""
    init_db()
    initialize_demo_data_if_needed()
