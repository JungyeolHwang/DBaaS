# DBaaS 운영 가이드 📚

초보자를 위한 완전한 운영 매뉴얼

## 📋 목차
1. [환경 확인 및 시작](#1-환경-확인-및-시작)
2. [서버 시작 및 중지](#2-서버-시작-및-중지)
3. [Kubernetes 클러스터 관리](#3-kubernetes-클러스터-관리)
4. [DB 인스턴스 생성 및 관리](#4-db-인스턴스-생성-및-관리)
5. [상태 확인 및 모니터링](#5-상태-확인-및-모니터링)
6. [문제 해결 및 디버깅](#6-문제-해결-및-디버깅)
7. [정리 및 종료](#7-정리-및-종료)

---

## 1. 환경 확인 및 시작

### 1.1 필수 도구 확인
시작하기 전에 모든 도구가 설치되어 있는지 확인:

```bash
# Node.js 버전 확인
node --version
# 출력 예: v24.1.0

# npm 버전 확인  
npm --version
# 출력 예: 11.3.0

# Docker 상태 확인
docker --version
docker ps
# Docker Desktop이 실행 중이어야 함

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

### 1.2 Kubernetes 클러스터 시작

```bash
# 1. minikube 시작 (가장 중요!)
minikube start --driver=docker --memory=4096 --cpus=2

# 성공 시 출력:
# ✅  minikube v1.36.0 on Darwin 15.5 (arm64)
# ✨  Using the docker driver based on user configuration
# 🏄  Done! kubectl is now configured to use "minikube" cluster

# 2. 클러스터 상태 확인
minikube status
# 출력:
# minikube
# type: Control Plane
# host: Running
# kubelet: Running
# apiserver: Running
# kubeconfig: Configured

# 3. kubectl 연결 확인
kubectl cluster-info
# 출력: Kubernetes control plane is running at https://127.0.0.1:XXXXX
```

### 1.3 Helm 레포지토리 설정

```bash
# Bitnami 레포지토리 추가 (PostgreSQL, MySQL 차트 제공)
helm repo add bitnami https://charts.bitnami.com/bitnami

# 레포지토리 업데이트
helm repo update

# 설치된 레포지토리 확인
helm repo list
# 출력:
# NAME    URL
# bitnami https://charts.bitnami.com/bitnami
```

---

## 2. 서버 시작 및 중지

### 2.1 백엔드 서버 시작

```bash
# 1. 프로젝트 디렉토리로 이동
cd /Applications/projects/DBaas

# 2. 백엔드 디렉토리로 이동
cd backend

# 3. 의존성 설치 (최초 1회만)
npm install

# 4. 환경 설정 파일 복사 (최초 1회만)
cp env.example .env

# 5. 서버 시작 (개발 모드)
npm run dev

# 또는 프로덕션 모드
npm start

# 성공 시 출력:
# 🚀 Mini DBaaS API Server running on port 3000
# 📡 Health check: http://localhost:3000/health
# 📚 API docs: http://localhost:3000/
```

### 2.2 서버 상태 확인

```bash
# 새 터미널에서 헬스체크
curl http://localhost:3000/health

# 성공 시 출력:
# {"status":"healthy","timestamp":"2025-07-18T13:XX:XX.XXXZ","version":"1.0.0"}

# API 정보 확인
curl http://localhost:3000/

# 출력:
# {"message":"Mini DBaaS API Server","version":"1.0.0","endpoints":{"health":"/health","instances":"/instances"}}
```

### 2.3 서버 중지

```bash
# 실행 중인 Node.js 서버 종료
pkill -f "node.*index.js"

# 또는 터미널에서 Ctrl+C
```

---

## 3. Kubernetes 클러스터 관리

### 3.1 기본 상태 확인 명령어

```bash
# 클러스터 전체 상태
kubectl cluster-info

# 모든 네임스페이스의 Pod 확인
kubectl get pods --all-namespaces

# DBaaS 관련 네임스페이스만 확인
kubectl get namespaces | grep dbaas

# 특정 네임스페이스의 모든 리소스 확인
kubectl get all -n dbaas-INSTANCE-NAME
```

### 3.2 네임스페이스 관리

```bash
# 네임스페이스 목록 확인
kubectl get namespaces

# 특정 네임스페이스 생성
kubectl create namespace my-namespace

# 네임스페이스 삭제
kubectl delete namespace my-namespace
```

### 3.3 minikube 관리

```bash
# minikube 시작
minikube start

# minikube 중지
minikube stop

# minikube 상태 확인
minikube status

# minikube 대시보드 (웹 UI)
minikube dashboard

# minikube IP 확인
minikube ip

# minikube 완전 삭제 (주의!)
minikube delete
```

---

## 4. DB 인스턴스 생성 및 관리

### 4.1 PostgreSQL 인스턴스 생성

```bash
# 기본 PostgreSQL 생성
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "name": "my-postgres",
    "config": {
      "password": "securepass123",
      "database": "myapp",
      "storage": "2Gi"
    }
  }'

# 성공 시 출력:
# {"success":true,"message":"Instance creation started","instance":{...}}
```

### 4.2 MySQL 인스턴스 생성

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
```

### 4.3 인스턴스 목록 확인

```bash
# 모든 인스턴스 목록
curl http://localhost:3000/instances

# 출력 예:
# {"success":true,"count":1,"instances":[{"name":"my-postgres","type":"postgresql",...}]}
```

### 4.4 특정 인스턴스 상태 확인

```bash
# 인스턴스 상세 상태
curl http://localhost:3000/instances/my-postgres

# 연결 정보 확인 (자동 포트 포워딩 시작)
curl http://localhost:3000/instances/my-postgres/connection
```

### 4.5 인스턴스 삭제

```bash
# 인스턴스 삭제
curl -X DELETE http://localhost:3000/instances/my-postgres

# 성공 시 출력:
# {"success":true,"message":"Instance deleted successfully"}
```

---

## 5. 상태 확인 및 모니터링

### 5.1 Pod 상태 확인

```bash
# 특정 네임스페이스의 Pod 상태
kubectl get pods -n dbaas-my-postgres

# 상세 정보 확인
kubectl describe pod POD-NAME -n dbaas-my-postgres

# Pod 로그 확인 (실시간)
kubectl logs -f POD-NAME -n dbaas-my-postgres

# 예시:
kubectl logs -f my-postgres-postgresql-0 -n dbaas-my-postgres
```

### 5.2 서비스 상태 확인

```bash
# 서비스 목록
kubectl get svc -n dbaas-my-postgres

# 출력 예:
# NAME                     TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
# my-postgres-postgresql   ClusterIP   10.96.xxx.xxx   <none>        5432/TCP   5m
```

### 5.3 Helm 릴리스 관리

```bash
# 모든 Helm 릴리스 확인
helm list --all-namespaces

# 특정 릴리스 상태 확인
helm status my-postgres -n dbaas-my-postgres

# 릴리스 히스토리
helm history my-postgres -n dbaas-my-postgres

# 릴리스 삭제
helm uninstall my-postgres -n dbaas-my-postgres
```

### 5.4 리소스 사용량 확인

```bash
# Node 리소스 사용량
kubectl top nodes

# Pod 리소스 사용량
kubectl top pods -n dbaas-my-postgres

# 전체 클러스터 리소스
kubectl get nodes -o wide
```

---

## 6. 문제 해결 및 디버깅

### 6.1 일반적인 문제들

#### 문제 1: API 서버가 응답하지 않음
```bash
# 서버 프로세스 확인
ps aux | grep node

# 포트 사용 확인
lsof -i :3000

# 서버 재시작
pkill -f "node.*index.js"
cd backend && npm start
```

#### 문제 2: kubectl 명령어 오류
```bash
# 현재 컨텍스트 확인
kubectl config current-context

# minikube로 컨텍스트 변경
kubectl config use-context minikube

# kubeconfig 파일 확인
kubectl config view
```

#### 문제 3: Pod가 Running 상태가 되지 않음
```bash
# Pod 상태 자세히 확인
kubectl describe pod POD-NAME -n NAMESPACE

# Pod 이벤트 확인
kubectl get events -n NAMESPACE --sort-by=.metadata.creationTimestamp

# Pod 로그 확인
kubectl logs POD-NAME -n NAMESPACE
```

#### 문제 4: 포트 포워딩 실패
```bash
# 기존 포트 포워딩 프로세스 종료
pkill -f "kubectl port-forward"

# 포트 사용 확인
lsof -i :5432
lsof -i :5433
lsof -i :5434

# 다른 포트로 수동 포트 포워딩
kubectl port-forward svc/SERVICE-NAME 5435:5432 -n NAMESPACE
```

### 6.2 디버깅 도구

```bash
# Pod 내부 접속 (디버깅용)
kubectl exec -it POD-NAME -n NAMESPACE -- /bin/bash

# PostgreSQL 직접 접속 (Pod 내부에서)
kubectl exec -it my-postgres-postgresql-0 -n dbaas-my-postgres -- psql -U postgres

# 서비스 연결 테스트
kubectl run test-pod --image=postgres:17 --rm -it -- psql -h SERVICE-NAME.NAMESPACE.svc.cluster.local -U postgres
```

### 6.3 로그 모니터링

```bash
# API 서버 로그 (백엔드 터미널에서 확인)

# Kubernetes 이벤트 실시간 모니터링
kubectl get events --watch

# 특정 네임스페이스 이벤트
kubectl get events -n dbaas-my-postgres --watch
```

---

## 7. 정리 및 종료

### 7.1 개발 세션 종료 시

```bash
# 1. API 서버 중지
pkill -f "node.*index.js"

# 2. 포트 포워딩 중지
pkill -f "kubectl port-forward"

# 3. minikube 중지 (선택사항)
minikube stop
```

### 7.2 완전 정리 (주의!)

#### 방법 1: 단계별 수동 정리 (권장)

```bash
# 1. API 서버 종료
echo "1️⃣ API 서버 종료 중..."
pkill -f "node.*index.js"

# 2. 포트 포워딩 종료
echo "2️⃣ 포트 포워딩 종료 중..."
pkill -f "kubectl port-forward"

# 3. 현재 DBaaS 인스턴스 확인
echo "3️⃣ 현재 인스턴스 확인..."
kubectl get namespaces | grep dbaas
helm list --all-namespaces | grep dbaas

# 4. Helm 릴리스 삭제 (각각 실행)
helm uninstall INSTANCE-NAME -n dbaas-INSTANCE-NAME

# 예시:
# helm uninstall my-postgres -n dbaas-my-postgres
# helm uninstall my-mysql -n dbaas-my-mysql

# 5. 네임스페이스 삭제 (각각 실행)  
kubectl delete namespace dbaas-INSTANCE-NAME

# 예시:
# kubectl delete namespace dbaas-my-postgres
# kubectl delete namespace dbaas-my-mysql

# 6. 정리 확인
echo "6️⃣ 정리 상태 확인..."
kubectl get namespaces | grep dbaas || echo "✅ DBaaS 네임스페이스 없음"
helm list --all-namespaces | grep dbaas || echo "✅ DBaaS Helm 릴리스 없음"
```

#### 방법 2: 자동 정리 스크립트

```bash
# 전체 DBaaS 시스템 한 번에 정리 (위험!)
./scripts/cleanup-all.sh
```

#### 방법 3: minikube 완전 초기화 (최후 수단)

```bash
# minikube 완전 삭제 (모든 데이터 손실!)
minikube delete

# 새로 시작
minikube start
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### 7.3 일시 중지 (재시작 가능)

```bash
# minikube만 중지 (데이터 보존)
minikube stop

# 다시 시작할 때
minikube start
cd backend && npm start
```

---

## 8. 유용한 스크립트와 명령어

### 8.1 자동화 스크립트

```bash
# 전체 시스템 상태 확인
./scripts/check-status.sh

# 모든 DBaaS 리소스 정리 (주의: 모든 데이터 삭제!)
./scripts/cleanup-all.sh

# 환경 자동 설정
./scripts/setup.sh

# API 자동 테스트
./scripts/test-api.sh
```

### 8.2 유용한 원라이너 명령어 모음

```bash
# 전체 상태 한 번에 확인
echo "=== minikube ===" && minikube status && \
echo "=== API Server ===" && curl -s http://localhost:3000/health && \
echo "=== DBaaS Pods ===" && kubectl get pods --all-namespaces | grep dbaas

# 모든 DBaaS 네임스페이스 목록
kubectl get ns | grep dbaas

# 모든 DBaaS Pod 상태
kubectl get pods --all-namespaces | grep dbaas

# 실행 중인 포트 포워딩 확인
ps aux | grep "kubectl port-forward"

# 사용 중인 포트 확인
lsof -i :3000 -i :5432 -i :5433 -i :5434

# Helm 릴리스 한 번에 확인
helm list -A | grep dbaas

# 모든 DBaaS 관련 프로세스 종료
pkill -f "node.*index.js" && pkill -f "kubectl port-forward"
```

---

## 9. 개발 워크플로우 예시

### 일반적인 하루 작업 시작:
```bash
# 1. 환경 시작
minikube start
cd /Applications/projects/DBaas/backend
npm start

# 2. 상태 확인
curl http://localhost:3000/health
kubectl get pods --all-namespaces | grep dbaas

# 3. 새 인스턴스 생성
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{"type": "postgresql", "name": "dev-db", "config": {"password": "dev123"}}'

# 4. 연결 정보 확인
curl http://localhost:3000/instances/dev-db/connection

# 5. DBeaver로 연결
```

### 작업 종료:
```bash
# 개발용 인스턴스 삭제
curl -X DELETE http://localhost:3000/instances/dev-db

# 서버 중지
pkill -f "node.*index.js"

# minikube 중지 (선택)
minikube stop
```

---

이 가이드를 북마크해두시고 하나씩 따라해보시면 완전히 이해하실 수 있을 것입니다! 🚀 

개발하실 때는 `npm run dev`를 사용하시면 코드 수정할 때마다 자동으로 서버가 재시작되어 훨씬 편리할 거예요! 🎯 