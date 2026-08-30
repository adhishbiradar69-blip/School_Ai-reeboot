import os

SECRET_KEY = os.environ.get("SCHOOLAI_SECRET_KEY", "schoolai_dev_secret_change_me_in_prod_9f2a7c1e")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("SCHOOLAI_TOKEN_EXPIRE_MINUTES", "480"))
