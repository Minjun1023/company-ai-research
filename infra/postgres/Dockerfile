FROM pgvector/pgvector:pg16

# 프로젝트 루트 기준 경로에서 초기 SQL을 컨테이너 진입점에 복사한다.
COPY infra/postgres/extensions.sql /docker-entrypoint-initdb.d/01-extensions.sql
COPY infra/postgres/init.sql /docker-entrypoint-initdb.d/02-init.sql
