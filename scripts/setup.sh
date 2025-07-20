#!/bin/bash

# Mini DBaaS 환경 설정 스크립트

echo "🚀 Mini DBaaS 환경 설정을 시작합니다..."

# 색상 코드 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 오류 발생 시 스크립트 종료
set -e

# 함수: 성공 메시지
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 함수: 경고 메시지
warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# 함수: 오류 메시지
error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. 필수 도구 확인
echo "📋 필수 도구 확인 중..."

check_tool() {
    if command -v $1 &> /dev/null; then
        success "$1 설치됨"
    else
        error "$1이 설치되어 있지 않습니다. 먼저 설치해주세요."
        exit 1
    fi
}

check_tool "node"
check_tool "npm"
check_tool "kubectl"
check_tool "helm"
check_tool "minikube"

# 2. minikube 상태 확인 및 시작
echo "🔧 minikube 설정 중..."

if minikube status &> /dev/null; then
    success "minikube가 이미 실행 중입니다"
else
    echo "minikube를 시작합니다... (6GB 메모리, 3 CPU)"
    minikube start --driver=docker --memory=6144 --cpus=3
    success "minikube 시작 완료"
fi

# 3. minikube 애드온 활성화
echo "🔌 minikube 애드온 활성화 중..."

minikube addons enable volumesnapshots &> /dev/null || true
minikube addons enable csi-hostpath-driver &> /dev/null || true
success "volumesnapshots, csi-hostpath-driver 애드온 활성화 완료"

# 4. Helm 레포지토리 설정
echo "📦 Helm 레포지토리 설정 중..."

helm repo add bitnami https://charts.bitnami.com/bitnami &> /dev/null || true
helm repo update
success "Helm 레포지토리 설정 완료"

# 5. PostgreSQL HA Operator 설치
echo "🐘 PostgreSQL HA Operator (CloudNativePG) 설치 중..."

if kubectl get pods -n cnpg-system 2>/dev/null | grep -q cnpg-controller-manager; then
    success "CloudNativePG Operator가 이미 설치되어 있습니다"
else
    kubectl apply --server-side -f https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.18/releases/cnpg-1.18.1.yaml
    # Operator 시작 대기
    echo "  ⏳ Operator 시작 대기 중..."
    kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=cloudnative-pg -n cnpg-system --timeout=120s
    success "CloudNativePG Operator 설치 완료"
fi

# 6. MySQL HA Operator 설치
echo "🐬 MySQL HA Operator (Percona XtraDB) 설치 중..."

if kubectl get pods -n default 2>/dev/null | grep -q percona-xtradb-cluster-operator; then
    success "Percona XtraDB Cluster Operator가 이미 설치되어 있습니다"
else
    kubectl apply --server-side -f https://raw.githubusercontent.com/percona/percona-xtradb-cluster-operator/v1.17.0/deploy/bundle.yaml
    # Operator 시작 대기
    echo "  ⏳ Operator 시작 대기 중..."
    kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=percona-xtradb-cluster-operator -n default --timeout=120s
    success "Percona XtraDB Cluster Operator 설치 완료"
fi

# 7. 기본 네임스페이스 생성
echo "🏗️ Kubernetes 네임스페이스 설정 중..."

kubectl create namespace dbaas --dry-run=client -o yaml | kubectl apply -f - &> /dev/null
success "dbaas 네임스페이스 생성 완료"

# 8. 백엔드 의존성 설치
echo "📚 백엔드 의존성 설치 중..."

cd backend
if [ ! -f ".env" ]; then
    cp env.example .env
    echo "" >> .env
    echo "# Metadata Database Configuration" >> .env
    echo "METADATA_DB_HOST=localhost" >> .env
    echo "METADATA_DB_PORT=5434" >> .env
    echo "METADATA_DB_NAME=dbaas_metadata" >> .env
    echo "METADATA_DB_USER=postgres" >> .env
    echo "METADATA_DB_PASSWORD=dbaas123" >> .env
    warning ".env 파일을 생성하고 메타데이터 DB 설정을 추가했습니다."
fi

npm install
success "백엔드 의존성 설치 완료"

# 9. 메타데이터 DB 인스턴스 생성 (선택사항)
echo "📊 메타데이터 저장용 PostgreSQL 인스턴스 생성 중..."
cd ..

# 임시로 서버 시작하여 메타데이터 DB 생성
echo "  🚀 임시 API 서버 시작..."
cd backend
npm start &
SERVER_PID=$!
sleep 15

# 메타데이터 DB 인스턴스 생성
echo "  📝 메타데이터 DB 인스턴스 생성..."
if curl -s -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{"type": "postgresql", "name": "dbaas-metadata", "config": {"password": "dbaas123", "database": "dbaas_metadata", "storage": "1Gi", "memory": "256Mi", "cpu": "250m"}}' | grep -q "success"; then
    success "메타데이터 DB 인스턴스 생성 완료"
else
    warning "메타데이터 DB 인스턴스가 이미 존재하거나 생성에 실패했습니다"
fi

# 서버 종료
echo "  🛑 임시 API 서버 종료..."
kill $SERVER_PID 2>/dev/null || true
sleep 3

cd ..

# 10. 설정 완료 메시지
echo ""
echo "🎉 Mini DBaaS 환경 설정이 완료되었습니다!"
echo ""
echo "📝 다음 단계:"
echo "  1. 백엔드 서버 시작: cd backend && npm start"
echo "  2. API 테스트: curl http://localhost:3000/health"
echo "  3. 메타데이터 마이그레이션 (필요시): cd backend && node simple-migrate.js"
echo ""
echo "🎯 DB 인스턴스 생성 예시:"
echo "  📋 PostgreSQL (기본):"
echo "     curl -X POST http://localhost:3000/instances \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"type\": \"postgresql\", \"name\": \"my-db\"}'"
echo ""
echo "  🐘 PostgreSQL HA 클러스터:"
echo "     curl -X POST http://localhost:3000/ha-clusters/postgresql \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"name\": \"pg-ha\", \"config\": {\"replicas\": 3}}'"
echo ""
echo "  🐬 MySQL HA 클러스터:"
echo "     curl -X POST http://localhost:3000/ha-clusters/mysql \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"name\": \"mysql-ha\", \"config\": {\"replicas\": 3}}'"
echo ""
echo "💾 데이터 지속성:"
echo "  - 메타데이터는 PostgreSQL DB에 자동 저장됩니다"
echo "  - 서버 재시작 후에도 모든 인스턴스 정보가 유지됩니다"
echo "  - minikube stop/start: 모든 설정 보존 ✅"
echo "  - minikube delete: 모든 설정 초기화 ❌ (이 스크립트 재실행 필요)"
echo ""
echo "📊 모니터링 (선택사항):"
echo "  - scripts/setup-monitoring.sh 실행"
echo ""
echo "🔧 유용한 명령어:"
echo "  - kubectl get pods -A                          # 전체 Pod 상태"
echo "  - kubectl get clusters --all-namespaces        # PostgreSQL HA 클러스터"
echo "  - kubectl get perconaxtradbclusters -A         # MySQL HA 클러스터"
echo "  - helm list -A                                 # Helm 릴리스 목록"
echo "  - minikube dashboard                           # Kubernetes 대시보드"
echo ""

success "설정 완료! 🚀" 