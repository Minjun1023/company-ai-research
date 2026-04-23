# API 문서

현재 구현 기준으로 Java 백엔드와 Python AI 서비스의 OpenAPI 문서를 수동 정리한 파일들이다.

## 파일

- `backend-openapi.yaml`
- `ai-service-openapi.yaml`

## 보는 방법

### 1. Swagger Editor에 업로드

- https://editor.swagger.io/
- 좌측 내용을 비우고 각 YAML 파일 내용을 붙여넣으면 된다.

### 2. 로컬에서 Swagger UI로 보기

다음처럼 Swagger UI용 정적 서버를 하나 띄워도 된다.

```bash
docker run --rm -p 8081:8080 \
  -e SWAGGER_JSON=/spec/backend-openapi.yaml \
  -v $(pwd)/docs/api:/spec \
  swaggerapi/swagger-ui
```

AI 서비스 문서를 보고 싶으면 `SWAGGER_JSON=/spec/ai-service-openapi.yaml` 로 바꾸면 된다.

## 참고

- `ai-service`는 FastAPI라 실제 런타임 문서도 기본 제공된다.
  - `http://localhost:8000/docs`
  - `http://localhost:8000/redoc`
- Java 백엔드는 현재 `springdoc-openapi` 의존성이 없어서 런타임 Swagger UI는 기본 제공되지 않는다.
  - 그래서 이 폴더의 YAML 문서를 기준 문서로 관리한다.
