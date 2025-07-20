#!/bin/bash

# DBaaS 시스템 상태 확인 스크립트

echo "🔍 Mini DBaaS 시스템 상태 확인"
echo "================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 성공/실패 함수
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

echo ""
echo -e "${BLUE}📋 1. 기본 도구 상태${NC}"
echo "-------------------"

# Docker 확인
docker ps &> /dev/null
check_status $? "Docker 실행 중"

# minikube 확인
minikube status &> /dev/null
check_status $? "minikube 실행 중"

# kubectl 확인
kubectl cluster-info &> /dev/null
check_status $? "kubectl 연결 가능"

echo ""
echo -e "${BLUE}📡 2. API 서버 상태${NC}"
echo "-------------------"

# API 서버 헬스체크
response=$(curl -s http://localhost:3000/health 2>/dev/null)
if [[ $response == *"healthy"* ]]; then
    echo -e "${GREEN}✅ API 서버 실행 중 (포트 3000)${NC}"
else
    echo -e "${RED}❌ API 서버 응답 없음${NC}"
    echo -e "${YELLOW}   시작하려면: cd backend && npm start${NC}"
fi

echo ""
echo -e "${BLUE}🏗️ 3. Kubernetes 클러스터${NC}"
echo "------------------------"

# 네임스페이스 확인
echo "DBaaS 네임스페이스:"
kubectl get namespaces 2>/dev/null | grep dbaas | while read line; do
    echo -e "  ${GREEN}📁 $line${NC}"
done

if [ $(kubectl get namespaces 2>/dev/null | grep -c dbaas) -eq 0 ]; then
    echo -e "  ${YELLOW}📁 DBaaS 네임스페이스 없음${NC}"
fi

echo ""
echo -e "${BLUE}💾 4. 실행 중인 DB 인스턴스${NC}"
echo "----------------------------"

# Pod 상태 확인
pods=$(kubectl get pods --all-namespaces 2>/dev/null | grep dbaas)
if [ -n "$pods" ]; then
    echo "$pods" | while read namespace name ready status restarts age; do
        if [[ $status == "Running" ]]; then
            echo -e "  ${GREEN}🟢 $name ($namespace) - $status${NC}"
        else
            echo -e "  ${YELLOW}🟡 $name ($namespace) - $status${NC}"
        fi
    done
else
    echo -e "  ${YELLOW}🟡 실행 중인 DB 인스턴스 없음${NC}"
fi

echo ""
echo -e "${BLUE}🔌 5. 포트 포워딩 상태${NC}"
echo "----------------------"

# 포트 포워딩 프로세스 확인
port_forwards=$(ps aux 2>/dev/null | grep "kubectl port-forward" | grep -v grep)
if [ -n "$port_forwards" ]; then
    echo "$port_forwards" | while read line; do
        echo -e "  ${GREEN}🔗 $(echo $line | awk '{print $11, $12, $13}')${NC}"
    done
else
    echo -e "  ${YELLOW}🔗 활성 포트 포워딩 없음${NC}"
fi

echo ""
echo -e "${BLUE}🎛️ 6. Helm 릴리스${NC}"
echo "----------------"

# Helm 릴리스 확인
releases=$(helm list --all-namespaces 2>/dev/null | grep dbaas)
if [ -n "$releases" ]; then
    echo "$releases" | while read name namespace revision updated status chart app_version; do
        if [[ $status == "deployed" ]]; then
            echo -e "  ${GREEN}📦 $name ($namespace) - $status${NC}"
        else
            echo -e "  ${YELLOW}📦 $name ($namespace) - $status${NC}"
        fi
    done
else
    echo -e "  ${YELLOW}📦 배포된 Helm 릴리스 없음${NC}"
fi

echo ""
echo -e "${BLUE}💡 7. 빠른 액션 가이드${NC}"
echo "---------------------"

# API 서버가 실행 중이 아니면
if [[ $response != *"healthy"* ]]; then
    echo -e "${YELLOW}🚀 API 서버 시작:${NC} cd backend && npm start"
fi

# minikube가 실행 중이 아니면
if ! minikube status &> /dev/null; then
    echo -e "${YELLOW}🎯 minikube 시작:${NC} minikube start"
fi

# DB 인스턴스가 없으면
if [ $(kubectl get pods --all-namespaces 2>/dev/null | grep -c dbaas) -eq 0 ]; then
    echo -e "${YELLOW}💾 DB 인스턴스 생성:${NC}"
    echo '    curl -X POST http://localhost:3000/instances \'
    echo '      -H "Content-Type: application/json" \'
    echo '      -d '\''{"type": "postgresql", "name": "test-db", "config": {"password": "test123"}}'\'''
fi

echo ""
echo -e "${GREEN}✨ 상태 확인 완료!${NC}"
echo ""
echo -e "${BLUE}📖 더 자세한 정보는 OPERATIONS_GUIDE.md 참조${NC}"
echo "" 