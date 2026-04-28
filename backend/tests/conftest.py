import os
# Must be set BEFORE any app imports to prevent settings validation from failing
os.environ["TESTING"] = "1"

import pytest
