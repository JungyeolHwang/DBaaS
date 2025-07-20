# 🚀 DBaaS 완전 실습 가이드 (초보자용)

**목표**: 처음부터 끝까지 따라하면서 PostgreSQL과 MySQL 서비스, 그리고 HA 클러스터까지 만들어보기!

> **💡 이 가이드는 실제 테스트를 거쳐 검증된 단계별 가이드입니다.**
> **🎯 PostgreSQL HA 클러스터까지 완전히 구성할 수 있습니다.**

---

## ✅ 1단계: 환경 완전 초기화

### 1.1 기존 환경 정리 (중요!)

```bash
# 🚨 기존 환경 완전 정리 (모든 데이터 삭제)
minikube delete
# 모든 Kubernetes 리소스, 데이터, 설정이 삭제됩니다

# Docker 이미지 정리 (선택사항)
docker system prune -a
# 사용하지 않는 이미지들을 정리합니다
```

### 1.2 필수 도구들이 설치되어 있는지 확인

```bash
# Node.js 확인 (v18 이상 필요)
node --version
# 출력 예: v24.1.0

# npm 확인
npm --version
# 출력 예: 11.3.0

# Docker 확인 (Docker Desktop이 실행 중이어야 함)
docker --version
docker ps
# 에러가 나면 Docker Desktop을 시작하세요

# kubectl 확인
kubectl version --client
# 출력 예: Client Version: v1.32.2

# minikube 확인
minikube version
# 출력 예: minikube version: v1.36.0

# Helm 확인
helm version
# 출력 예: version.BuildInfo{Version:"v3.18.4"}
```

**❌ 만약 설치되지 않은 도구가 있다면**:
- Docker Desktop: https://www.docker.com/products/docker-desktop
- kubectl: `brew install kubectl` (macOS)
- minikube: `brew install minikube` (macOS)  
- Helm: `brew install helm` (macOS)

---

## ⚙️ 2단계: Kubernetes 클러스터 시작

### 2.1 minikube 시작 (단일 노드로 시작)

```bash
# 1. minikube 시작 (단일 노드로 시작 - HA 테스트에 최적)
minikube start --driver=docker --memory=4096 --cpus=2 --nodes=1

# 🎯 성공하면 이런 메시지가 나옵니다:
# ✅  minikube v1.36.0 on Darwin 15.5 (arm64)
# ✨  Using the docker driver based on user configuration
# 🏄  Done! kubectl is now configured to use "minikube" cluster
```

### 2.2 CSI 드라이버 설치 (스토리지용)

```bash
# CSI 호스트패스 드라이버 설치 (스토리지 지원)
minikube addons enable hostpath-provisioner

# 🎯 성공하면 이런 메시지가 나옵니다:
# The 'hostpath-provisioner' addon is enabled
```

```bash
# 1. minikube 시작 (첫 실행시 약 2-3분 소요)
minikube start --driver=docker --memory=4096 --cpus=2

# 🎯 성공하면 이런 메시지가 나옵니다:
# ✅  minikube v1.36.0 on Darwin 15.5 (arm64)
# ✨  Using the docker driver based on user configuration
# 🏄  Done! kubectl is now configured to use "minikube" cluster
```

### 2.3 클러스터 상태 확인

```bash
# minikube 상태 확인
minikube status

# 🎯 정상이면 이렇게 나옵니다:
# minikube
# type: Control Plane
# host: Running
# kubelet: Running
# apiserver: Running
# kubeconfig: Configured
```

### 2.4 kubectl 연결 확인

```bash
# Kubernetes 클러스터 정보 확인
kubectl cluster-info

# 🎯 성공하면 이런 메시지가 나옵니다:
# Kubernetes control plane is running at https://127.0.0.1:xxxxx
```

---

## 🏗️ 3단계: 메타데이터베이스 및 오퍼레이터 설치

### 3.1 메타데이터베이스 설치 (PostgreSQL)

```bash
# 1. 메타데이터 DB 네임스페이스 생성
kubectl create namespace dbaas-dbaas-metadata

# 2. PostgreSQL Helm 차트로 메타데이터 DB 설치
helm install dbaas-metadata ./helm-charts/postgresql-local \
  --namespace dbaas-dbaas-metadata \
  --set postgresql.auth.postgresPassword=postgres123 \
  --set postgresql.auth.database=dbaas_metadata

# 🎯 성공하면 이런 메시지가 나옵니다:
# NAME: dbaas-metadata
# STATUS: deployed
# NOTES: ...
```

### 3.2 메타데이터 DB 상태 확인

```bash
# Pod 상태 확인
kubectl get pods -n dbaas-dbaas-metadata

# 🎯 1-2분 후 이렇게 나와야 합니다:
# NAME                                    READY   STATUS    RESTARTS   AGE
# dbaas-metadata-postgresql-local-0       1/1     Running   0          2m

# 서비스 확인
kubectl get services -n dbaas-dbaas-metadata
# NAME                              TYPE        CLUSTER-IP      PORT(S)
# dbaas-metadata-postgresql-local   ClusterIP   10.96.xxx.xxx   5432/TCP
```

### 3.3 메타데이터 DB 포트포워딩 설정

```bash
# 메타데이터 DB 포트포워딩 (백그라운드 실행)
kubectl port-forward --namespace dbaas-dbaas-metadata \
  svc/dbaas-metadata-postgresql-local 5434:5432 &

# 🎯 성공하면 이런 메시지가 나옵니다:
# Forwarding from 127.0.0.1:5434 -> 5432
# Forwarding from [::1]:5434 -> 5432
```

### 3.4 PostgreSQL HA 오퍼레이터 설치 (Zalando)

```bash
# 1. CloudNativePG 제거 (있다면)
kubectl delete -f https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.20/releases/cnpg-1.20.1.yaml 2>/dev/null || true

# 2. Zalando PostgreSQL Operator 설치 (minikube 호환)
kubectl apply -k github.com/zalando/postgres-operator/manifests

# 🎯 성공하면 이런 메시지가 나옵니다:
# namespace/postgres-operator created
# serviceaccount/postgres-operator created
# ...

# 3. 오퍼레이터 상태 확인
kubectl get pods | grep postgres-operator
# NAME                                READY   STATUS    RESTARTS   AGE
# postgres-operator-849bdbdbd8-rxcn2   1/1     Running   0          30s
```

### 3.5 프로젝트 디렉토리로 이동

```bash
# DBaaS 프로젝트 폴더로 이동
cd /Applications/projects/DBaas

# 백엔드 폴더로 이동
cd backend
```

### 3.6 의존성 설치 (최초 1회만)

```bash
# Node.js 패키지 설치
npm install

# 🎯 성공하면 node_modules 폴더가 생성됩니다
ls -la
# package-lock.json과 node_modules가 보여야 함
```

### 3.7 환경 설정 파일 생성 (최초 1회만)

```bash
# 환경 설정 파일 복사
cp env.example .env

# 설정 파일 확인
cat .env
```

---

## 🚀 4단계: 백엔드 서버 시작

### 4.1 메타데이터 DB 스키마 초기화

```bash
# 메타데이터 DB 스키마 생성 및 초기화
cd backend
node simple-migrate.js

# 🎯 성공하면 이런 메시지가 나옵니다:
# ✅ Database connection successful
# ✅ Tables created successfully
# ✅ Sample data inserted
```

### 4.2 개발 모드로 서버 시작

```bash
# 개발 모드로 시작 (파일 변경시 자동 재시작)
npm run dev

# 🎯 성공하면 이런 메시지가 나옵니다:
# 🚀 Mini DBaaS API Server running on port 3000
# 📡 Health check: http://localhost:3000/health
# 📚 API docs: http://localhost:3000/
```

**✋ 서버를 계속 실행 상태로 두고, 새 터미널을 여세요!**

### 4.3 서버 작동 확인 (새 터미널에서)

```bash
# 새 터미널 열고 헬스체크
curl http://localhost:3000/health

# 🎯 성공하면 이런 응답이 나옵니다:
# {"status":"healthy","timestamp":"2025-01-XX...","version":"1.0.0"}

# API 정보 확인
curl http://localhost:3000/

# 🎯 성공하면 이런 응답이 나옵니다:
# {"message":"Mini DBaaS API Server","version":"1.0.0","endpoints":{"health":"/health","instances":"/instances"}}
```

---

## 🐘 5단계: PostgreSQL HA 클러스터 생성 및 테스트

### 5.1 PostgreSQL HA 클러스터 생성

```bash
# PostgreSQL HA 클러스터 생성 (3개 노드)
curl -X POST http://localhost:3000/ha-clusters/zalando-postgresql \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-ha-cluster",
    "namespace": "dbaas-zalando-test",
    "config": {
      "replicas": 3,
      "storage": "1Gi",
      "username": "admin",
      "database": "testdb"
    }
  }'

# 🎯 성공하면 이런 응답이 나옵니다:
# {"success":true,"message":"PostgreSQL HA cluster creation started","cluster":{...}}
```

### 5.2 HA 클러스터 생성 과정 모니터링

```bash
# HA 클러스터 Pod 상태 확인 (실시간)
kubectl get pods -n dbaas-zalando-test --watch

# 🎯 처음엔 이렇게 나오다가:
# NAME                     READY   STATUS              RESTARTS   AGE
# zalando-test-cluster-0   0/1     ContainerCreating   0          30s
# zalando-test-cluster-1   0/1     Pending             0          25s
# zalando-test-cluster-2   0/1     Pending             0          20s

# 🎯 1-2분 후 이렇게 변합니다:
# NAME                     READY   STATUS    RESTARTS   AGE
# zalando-test-cluster-0   1/1     Running   0          2m    # Primary
# zalando-test-cluster-1   1/1     Running   0          1m50s # Standby
# zalando-test-cluster-2   1/1     Running   0          1m45s # Standby

# Ctrl+C로 watch 종료
```

### 5.3 HA 클러스터 상태 확인

```bash
# 클러스터 정보 확인
kubectl get postgresql -n dbaas-zalando-test
# NAME                   TEAMID   VERSION   PODS   VOLUME   CPU-REQUEST   MEMORY-REQUEST   AGE   STATUS
# zalando-test-cluster   dbaas    15        3      1Gi      100m          100Mi           5m    Running

# 서비스 엔드포인트 확인
kubectl get endpoints -n dbaas-zalando-test
# NAME                      ENDPOINTS
# zalando-test-cluster      10.244.0.15:5432           # Master(Primary)
# zalando-test-cluster-repl 10.244.0.16:5432,10.244.0.17:5432  # Replica(Standby)
```

### 5.4 HA 클러스터 연결 테스트

```bash
# Primary에 연결하여 상태 확인
kubectl exec -it zalando-test-cluster-0 -n dbaas-zalando-test -- \
  psql -U admin -d testdb -c "SELECT pg_is_in_recovery();"
# 결과: f (false = Primary)

# Standby에 연결하여 상태 확인
kubectl exec -it zalando-test-cluster-1 -n dbaas-zalando-test -- \
  psql -U admin -d testdb -c "SELECT pg_is_in_recovery();"
# 결과: t (true = Standby)

# 복제 상태 확인 (Primary에서)
kubectl exec -it zalando-test-cluster-0 -n dbaas-zalando-test -- \
  psql -U admin -d testdb -c "SELECT client_addr, state, sync_state FROM pg_stat_replication;"
# 결과: 2개의 Standby 연결 확인
```

### 5.5 HA Failover 테스트

```bash
# 🚨 Primary Pod 강제 삭제 (Failover 트리거)
echo "🚨 Primary Pod 삭제 시작: $(date)" 
kubectl delete pod zalando-test-cluster-0 -n dbaas-zalando-test

# 🎯 15초 후 상태 확인
kubectl get pods -n dbaas-zalando-test
# NAME                     READY   STATUS    RESTARTS   AGE
# zalando-test-cluster-0   1/1     Running   0          6s    # 새로 생성됨
# zalando-test-cluster-1   1/1     Running   0          5m51s # 새 Primary로 승격!
# zalando-test-cluster-2   1/1     Running   0          5m50s # 기존 Standby

# 🎯 서비스 엔드포인트 자동 전환 확인
kubectl get endpoints -n dbaas-zalando-test
# NAME                      ENDPOINTS
# zalando-test-cluster      10.244.0.16:5432           # 변경! Pod1이 새 Master
# zalando-test-cluster-repl 10.244.0.17:5432,10.244.0.18:5432  # Pod2 + 새 Pod0

# 🎯 새 Primary 역할 확인
kubectl exec -it zalando-test-cluster-1 -n dbaas-zalando-test -- \
  psql -U admin -d testdb -c "SELECT pg_is_in_recovery();"
# 결과: f (false = 성공적으로 Primary로 승격!)
```

## 🐘 6단계: 단일 PostgreSQL 인스턴스 생성 및 연결

### 6.1 PostgreSQL 인스턴스 생성

```bash
# PostgreSQL 인스턴스 생성
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "name": "my-postgres",
    "config": {
      "password": "mypass123",
      "database": "testdb",
      "storage": "2Gi"
    }
  }'

# 🎯 성공하면 이런 응답이 나옵니다:
# {"success":true,"message":"Instance creation started","instance":{...}}
```

### 5.2 생성 과정 모니터링

```bash
# 1. Kubernetes Pod 상태 확인 (실시간)
kubectl get pods -n dbaas-my-postgres --watch

# 🎯 처음엔 이렇게 나오다가:
# NAME                       READY   STATUS              RESTARTS   AGE
# my-postgres-postgresql-0   0/1     ContainerCreating   0          30s

# 🎯 1-2분 후 이렇게 변합니다:
# NAME                       READY   STATUS    RESTARTS   AGE
# my-postgres-postgresql-0   1/1     Running   0          2m

# Ctrl+C로 watch 종료
```

### 5.3 PostgreSQL 연결 정보 확인

```bash
# 연결 정보 조회 (자동 포트 포워딩 시작)
curl http://localhost:3000/instances/my-postgres/connection

# 🎯 성공하면 이런 응답이 나옵니다:
# {
#   "type": "AutoPortForward",
#   "host": "localhost",
#   "port": 5434,
#   "targetPort": 5432,
#   "serviceName": "my-postgres-postgresql",
#   "namespace": "dbaas-my-postgres",
#   "status": "active",
#   "note": "Automatically port forwarded to localhost:5434. Ready for DBeaver connection!"
# }
```

### 5.4 PostgreSQL 연결 테스트

```bash
# 1. 먼저 실제 Pod 이름 확인
kubectl get pods -n dbaas-my-postgres

# 예상 출력:
# NAME                              READY   STATUS    RESTARTS   AGE
# my-postgres-postgresql-local-0    1/1     Running   0          5m

# 2. 실제 Pod 이름으로 접속 (위에서 확인한 이름 사용)
kubectl exec -it my-postgres-postgresql-local-0 -n dbaas-my-postgres -- psql -U postgres -d testdb

# 3. 또는 자동으로 Pod 찾아서 접속
POD_NAME=$(kubectl get pods -n dbaas-my-postgres -o jsonpath='{.items[0].metadata.name}')
echo "PostgreSQL Pod 이름: $POD_NAME"
kubectl exec -it $POD_NAME -n dbaas-my-postgres -- psql -U postgres -d testdb

# 비밀번호: mypass123
# 🎯 성공하면 PostgreSQL 프롬프트가 나옵니다:
# testdb=# 
```

### 5.5 간단한 테스트 쿼리

```sql
-- PostgreSQL에 접속한 상태에서
CREATE TABLE test_table (id SERIAL PRIMARY KEY, name VARCHAR(50));
INSERT INTO test_table (name) VALUES ('Hello DBaaS!');
SELECT * FROM test_table;

-- 🎯 결과:
--  id |    name     
-- ----+-------------
--   1 | Hello DBaaS!

-- 종료
\q
```

---

## 🐬 7단계: MySQL 인스턴스 생성 및 연결

### 7.1 MySQL 인스턴스 생성

```bash
# MySQL 인스턴스 생성
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mysql",
    "name": "my-mysql",
    "config": {
      "password": "mysqlpass123",
      "storage": "1Gi"
    }
  }'

# 🎯 성공하면 이런 응답이 나옵니다:
# {"success":true,"message":"Instance creation started","instance":{...}}
```

### 6.2 MySQL 생성 과정 모니터링

```bash
# MySQL Pod 상태 확인
kubectl get pods -n dbaas-my-mysql --watch

# 🎯 1-2분 후 Running 상태가 되어야 합니다:
# NAME               READY   STATUS    RESTARTS   AGE
# my-mysql-mysql-0   1/1     Running   0          2m

# Ctrl+C로 watch 종료
```

### 6.3 MySQL 연결 정보 확인

```bash
# MySQL 연결 정보 조회
curl http://localhost:3000/instances/my-mysql/connection

# 🎯 성공하면 이런 응답이 나옵니다:
# {
#   "type": "AutoPortForward",
#   "host": "localhost",
#   "port": 5435,  👈 PostgreSQL과 다른 포트
#   "targetPort": 3306,
#   "serviceName": "my-mysql-mysql",
#   "namespace": "dbaas-my-mysql",
#   "status": "active"
# }
```

### 6.4 MySQL 연결 테스트

```bash
# 1. 먼저 실제 Pod 이름 확인
kubectl get pods -n dbaas-my-mysql

# 예상 출력:
# NAME                     READY   STATUS    RESTARTS   AGE
# my-mysql-mysql-local-0   1/1     Running   0          5m

# 2. 실제 Pod 이름으로 접속 (위에서 확인한 이름 사용)
kubectl exec -it my-mysql-mysql-local-0 -n dbaas-my-mysql -- mysql -u root -p

# 3. 또는 자동으로 Pod 찾아서 접속
POD_NAME=$(kubectl get pods -n dbaas-my-mysql -o jsonpath='{.items[0].metadata.name}')
echo "MySQL Pod 이름: $POD_NAME"
kubectl exec -it $POD_NAME -n dbaas-my-mysql -- mysql -u root -p

# 비밀번호: mysqlpass123
# 🎯 성공하면 MySQL 프롬프트가 나옵니다:
# mysql>
```

### 6.5 MySQL 테스트 쿼리

```sql
-- MySQL에 접속한 상태에서
CREATE DATABASE testdb;
USE testdb;
CREATE TABLE test_table (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50));
INSERT INTO test_table (name) VALUES ('Hello MySQL DBaaS!');
SELECT * FROM test_table;

-- 🎯 결과:
-- +----+-------------------+
-- | id | name              |
-- +----+-------------------+
-- |  1 | Hello MySQL DBaaS!|
-- +----+-------------------+

-- 종료
exit;
```

---

## 📊 8단계: 전체 상태 확인

### 8.1 생성된 모든 인스턴스 확인

```bash
# API를 통한 인스턴스 목록 확인
curl http://localhost:3000/instances

# 🎯 성공하면 이런 응답이 나옵니다:
# {
#   "success": true,
#   "count": 2,
#   "instances": [
#     {"name": "my-postgres", "type": "postgresql", ...},
#     {"name": "my-mysql", "type": "mysql", ...}
#   ]
# }
```

### 7.2 Kubernetes 리소스 확인

```bash
# 모든 DBaaS 네임스페이스 확인
kubectl get namespaces | grep dbaas

# 🎯 이런 결과가 나와야 합니다:
# dbaas-my-mysql      Active   10m
# dbaas-my-postgres   Active   15m

# 모든 DBaaS Pod 확인
kubectl get pods --all-namespaces | grep dbaas

# 🎯 이런 결과가 나와야 합니다:
# dbaas-my-mysql      my-mysql-mysql-0          1/1     Running   0          10m
# dbaas-my-postgres   my-postgres-postgresql-0  1/1     Running   0          15m
```

### 7.3 포트 포워딩 상태 확인

```bash
# 실행 중인 포트 포워딩 확인
ps aux | grep "kubectl port-forward"

# 🎯 이런 프로세스들이 보여야 합니다:
# kubectl port-forward -n dbaas-my-postgres svc/my-postgres-postgresql 5434:5432
# kubectl port-forward -n dbaas-my-mysql svc/my-mysql-mysql 5435:3306
```

---

## 🎯 9단계: DBeaver로 GUI 연결 (선택사항)

### 9.1 DBeaver 연결 설정

**PostgreSQL 연결**:
- 호스트: `localhost`
- 포트: `5434` (API 응답에서 확인한 포트)
- 데이터베이스: `testdb`
- 사용자명: `postgres`
- 비밀번호: `mypass123`

**MySQL 연결**:
- 호스트: `localhost`
- 포트: `5435` (API 응답에서 확인한 포트)
- 데이터베이스: `testdb`
- 사용자명: `root`
- 비밀번호: `mysqlpass123`

---

## 🧹 10단계: 정리 (실습 완료 후)

### 10.1 HA 클러스터 삭제

```bash
# PostgreSQL HA 클러스터 삭제
curl -X DELETE http://localhost:3000/ha-clusters/zalando-postgresql/test-ha-cluster

# 🎯 성공하면 이런 응답이 나옵니다:
# {"success":true,"message":"PostgreSQL HA cluster deleted successfully"}

# 네임스페이스 삭제
kubectl delete namespace dbaas-zalando-test
```

### 10.2 특정 인스턴스 삭제

```bash
# PostgreSQL 인스턴스 삭제
curl -X DELETE http://localhost:3000/instances/my-postgres

# MySQL 인스턴스 삭제
curl -X DELETE http://localhost:3000/instances/my-mysql

# 🎯 성공하면 이런 응답이 나옵니다:
# {"success":true,"message":"Instance deleted successfully"}
```

### 10.3 서버 중지

```bash
# 백엔드 서버 중지 (서버 실행 터미널에서 Ctrl+C)
# 또는 다른 터미널에서:
pkill -f "node.*index.js"
```

### 10.4 minikube 중지 (선택사항)

```bash
# minikube 중지 (데이터는 보존됨)
minikube stop

# 완전 삭제 (모든 데이터 삭제, 주의!)
# minikube delete
```

---

## 🎉 실습 완료!

축하합니다! 성공적으로 완료하셨다면:

✅ Kubernetes 클러스터 시작 (단일 노드)  
✅ 메타데이터베이스 설치 및 설정  
✅ PostgreSQL HA 오퍼레이터 설치 (Zalando)  
✅ Node.js 백엔드 API 서버 실행  
✅ PostgreSQL HA 클러스터 생성 (3노드)  
✅ HA Failover 테스트 성공 (15초 내 자동 전환)  
✅ 단일 PostgreSQL 인스턴스 생성 및 연결  
✅ MySQL 인스턴스 생성 및 연결  
✅ 실제 DB 쿼리 실행  
✅ 리소스 정리  

---

## 🆘 문제 해결

### ❌ 자주 발생하는 문제들

**1. 메타데이터 DB 연결 실패**
```bash
# 해결책: 포트포워딩 확인 및 재설정
kubectl get pods -n dbaas-dbaas-metadata
# Pod가 Running 상태인지 확인

# 포트포워딩 재설정
pkill -f "kubectl port-forward.*5434"
kubectl port-forward --namespace dbaas-dbaas-metadata \
  svc/dbaas-metadata-postgresql-local 5434:5432 &

# 스키마 초기화 재실행
cd backend && node simple-migrate.js
```

**2. HA 클러스터 생성 실패**
```bash
# 해결책: Zalando Operator 상태 확인
kubectl get pods | grep postgres-operator
# Operator가 Running 상태인지 확인

# 네임스페이스 재생성
kubectl delete namespace dbaas-zalando-test 2>/dev/null || true
kubectl create namespace dbaas-zalando-test

# HA 클러스터 재생성
curl -X POST http://localhost:3000/ha-clusters/zalando-postgresql \
  -H "Content-Type: application/json" \
  -d '{"name": "test-ha-cluster", "namespace": "dbaas-zalando-test", "config": {"replicas": 3}}'
```

**3. "connection refused" 에러**
```bash
# 해결책: minikube가 실행 중인지 확인
minikube status
minikube start  # 필요시
```

**2. "port already in use" 에러**
```bash
# 해결책: 기존 포트 포워딩 종료
pkill -f "kubectl port-forward"
```

**3. Pod가 "Pending" 상태로 멈춤**
```bash
# 해결책: 상세 정보 확인
kubectl describe pod POD-NAME -n NAMESPACE
# 보통 리소스 부족이 원인
```

**4. HA Failover 테스트 실패**
```bash
# 해결책: 클러스터 상태 확인
kubectl get pods -n dbaas-zalando-test
# 모든 Pod가 Running 상태인지 확인

# 복제 상태 확인
kubectl exec -it zalando-test-cluster-0 -n dbaas-zalando-test -- \
  psql -U admin -d testdb -c "SELECT * FROM pg_stat_replication;"
# Standby 연결이 정상인지 확인

# 다시 Failover 테스트
kubectl delete pod zalando-test-cluster-0 -n dbaas-zalando-test
```

**5. API 서버가 응답하지 않음**
```bash
# 해결책: 프로세스 확인 및 재시작
ps aux | grep node
pkill -f "node.*index.js"
cd backend && npm run dev
```

### 📞 도움이 필요하면

1. `./scripts/check-status.sh` - 전체 상태 확인
2. `./scripts/test-api.sh` - API 자동 테스트  
3. `./scripts/cleanup-all.sh` - 전체 정리

---

**🎯 이 문서를 북마크해두고 차근차근 따라해보세요!**
**문제가 생기면 에러 메시지를 정확히 확인하고 "문제 해결" 섹션을 참고하세요.**

## 💡 범용 스크립트 제안

더 편하게 사용할 수 있도록 간단한 헬퍼 스크립트도 만들 수 있어요:

```bash
# PostgreSQL HA 클러스터 상태 확인 스크립트
#!/bin/bash
CLUSTER_NAME=${1:-test-ha-cluster}
NAMESPACE="dbaas-zalando-test"
echo "=== PostgreSQL HA 클러스터 상태 ==="
kubectl get pods -n $NAMESPACE
echo ""
echo "=== 서비스 엔드포인트 ==="
kubectl get endpoints -n $NAMESPACE
echo ""
echo "=== Primary 확인 ==="
kubectl exec -it zalando-test-cluster-0 -n $NAMESPACE -- \
  psql -U admin -d testdb -c "SELECT pg_is_in_recovery();" 2>/dev/null || echo "Pod 0 접속 실패"
echo ""
echo "=== Standby 확인 ==="
kubectl exec -it zalando-test-cluster-1 -n $NAMESPACE -- \
  psql -U admin -d testdb -c "SELECT pg_is_in_recovery();" 2>/dev/null || echo "Pod 1 접속 실패"
```

```bash
# HA Failover 테스트 스크립트
#!/bin/bash
echo "🚨 HA Failover 테스트 시작: $(date)"
echo "1. 현재 Primary 확인..."
kubectl exec -it zalando-test-cluster-0 -n dbaas-zalando-test -- \
  psql -U admin -d testdb -c "SELECT pg_is_in_recovery();"
echo ""
echo "2. Primary Pod 삭제..."
kubectl delete pod zalando-test-cluster-0 -n dbaas-zalando-test
echo ""
echo "3. 15초 대기 후 상태 확인..."
sleep 15
kubectl get pods -n dbaas-zalando-test
echo ""
echo "4. 새 Primary 확인..."
kubectl exec -it zalando-test-cluster-1 -n dbaas-zalando-test -- \
  psql -U admin -d testdb -c "SELECT pg_is_in_recovery();"
echo "✅ Failover 테스트 완료!"
```

```bash
# PostgreSQL 접속 스크립트
#!/bin/bash
INSTANCE_NAME=${1:-my-postgres}
NAMESPACE="dbaas-$INSTANCE_NAME"
POD_NAME=$(kubectl get pods -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
echo "접속할 PostgreSQL Pod: $POD_NAME"
kubectl exec -it $POD_NAME -n $NAMESPACE -- psql -U postgres -d testdb

# MySQL 접속 스크립트  
#!/bin/bash
INSTANCE_NAME=${1:-my-mysql}
NAMESPACE="dbaas-$INSTANCE_NAME"
POD_NAME=$(kubectl get pods -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
echo "접속할 MySQL Pod: $POD_NAME"
kubectl exec -it $POD_NAME -n $NAMESPACE -- mysql -u root -p
```

이제 실제 Pod 이름을 확인하고 그에 맞춰 접속하시면 됩니다! 🎯
