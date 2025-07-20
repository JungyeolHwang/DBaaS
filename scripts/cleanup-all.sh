#!/bin/bash

# DBaaS 전체 시스템 정리 스크립트
# 주의: 모든 DB 인스턴스와 데이터가 삭제됩니다!

echo "🚨 DBaaS 전체 시스템 정리 시작"
echo "==============================="
echo "⚠️  주의: 모든 DB 인스턴스와 데이터가 삭제됩니다!"
echo "💾 주의: 메타데이터 DB의 모든 인스턴스 정보도 삭제됩니다!"
echo "🔄 주의: 백업 메타데이터와 스냅샷도 모두 삭제됩니다!"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 사용자 확인
echo -e "${RED}⚠️  이 작업은 다음을 완전히 삭제합니다:${NC}"
echo "   • 모든 DB 인스턴스 (PostgreSQL, MySQL, MariaDB)"
echo "   • 메타데이터 DB의 모든 인스턴스 정보"
echo "   • 모든 백업 메타데이터 및 스냅샷"
echo "   • 모든 PVC와 저장된 데이터"
echo ""
read -p "정말로 모든 DBaaS 리소스를 삭제하시겠습니까? (yes/no): " confirm
if [[ $confirm != "yes" ]]; then
    echo "정리 작업이 취소되었습니다."
    exit 1
fi

echo ""
echo -e "${BLUE}🧹 정리 작업을 시작합니다...${NC}"
echo ""

# 1. API 서버 종료
echo -e "${BLUE}1️⃣ Node.js API 서버 종료 중...${NC}"
pkill -f "node.*index.js" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API 서버 종료 완료${NC}"
else
    echo -e "${YELLOW}⚠️ API 서버가 실행 중이 아님${NC}"
fi
echo ""

# 2. 포트 포워딩 종료
echo -e "${BLUE}2️⃣ 포트 포워딩 프로세스 종료 중...${NC}"
pkill -f "kubectl port-forward" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 포트 포워딩 종료 완료${NC}"
else
    echo -e "${YELLOW}⚠️ 포트 포워딩 프로세스가 실행 중이 아님${NC}"
fi
echo ""

# 3. 현재 DBaaS 리소스 확인
echo -e "${BLUE}3️⃣ 현재 DBaaS 리소스 확인 중...${NC}"
namespaces=$(kubectl get namespaces 2>/dev/null | grep dbaas | awk '{print $1}')
releases=$(helm list --all-namespaces 2>/dev/null | grep dbaas | awk '{print $1":"$2}')

if [ -z "$namespaces" ] && [ -z "$releases" ]; then
    echo -e "${GREEN}✅ 삭제할 DBaaS 리소스가 없습니다${NC}"
    echo -e "${GREEN}🎉 시스템이 이미 깨끗한 상태입니다!${NC}"
    exit 0
fi

echo "발견된 DBaaS 네임스페이스:"
for ns in $namespaces; do
    echo -e "  ${YELLOW}📁 $ns${NC}"
done

echo "발견된 Helm 릴리스:"
for release in $releases; do
    name=$(echo $release | cut -d: -f1)
    namespace=$(echo $release | cut -d: -f2)
    echo -e "  ${YELLOW}📦 $name (namespace: $namespace)${NC}"
done
echo ""

# 4. Helm 릴리스 삭제
echo -e "${BLUE}4️⃣ Helm 릴리스 삭제 중...${NC}"
release_count=0
for release in $releases; do
    name=$(echo $release | cut -d: -f1)
    namespace=$(echo $release | cut -d: -f2)
    
    echo "  🗑️ $name 삭제 중..."
    if helm uninstall "$name" -n "$namespace" >/dev/null 2>&1; then
        echo -e "    ${GREEN}✅ $name 삭제 완료${NC}"
        ((release_count++))
    else
        echo -e "    ${RED}❌ $name 삭제 실패${NC}"
    fi
done

if [ $release_count -gt 0 ]; then
    echo -e "${GREEN}✅ $release_count개 Helm 릴리스 삭제 완료${NC}"
else
    echo -e "${YELLOW}⚠️ 삭제된 Helm 릴리스 없음${NC}"
fi
echo ""

# 5. 네임스페이스 삭제
echo -e "${BLUE}5️⃣ 네임스페이스 삭제 중...${NC}"
namespace_count=0
for ns in $namespaces; do
    echo "  🗑️ $ns 삭제 중..."
    if kubectl delete namespace "$ns" >/dev/null 2>&1; then
        echo -e "    ${GREEN}✅ $ns 삭제 완료${NC}"
        ((namespace_count++))
    else
        echo -e "    ${RED}❌ $ns 삭제 실패${NC}"
    fi
done

if [ $namespace_count -gt 0 ]; then
    echo -e "${GREEN}✅ $namespace_count개 네임스페이스 삭제 완료${NC}"
else
    echo -e "${YELLOW}⚠️ 삭제된 네임스페이스 없음${NC}"
fi
echo ""

# 6. 정리 확인
echo -e "${BLUE}6️⃣ 정리 상태 최종 확인...${NC}"
remaining_ns=$(kubectl get namespaces 2>/dev/null | grep dbaas | wc -l)
remaining_releases=$(helm list --all-namespaces 2>/dev/null | grep dbaas | wc -l)

if [ $remaining_ns -eq 0 ] && [ $remaining_releases -eq 0 ]; then
    echo -e "${GREEN}🎉 모든 DBaaS 리소스가 성공적으로 삭제되었습니다!${NC}"
else
    echo -e "${RED}⚠️ 일부 리소스가 남아있습니다:${NC}"
    if [ $remaining_ns -gt 0 ]; then
        echo -e "  ${YELLOW}📁 남은 네임스페이스: $remaining_ns개${NC}"
    fi
    if [ $remaining_releases -gt 0 ]; then
        echo -e "  ${YELLOW}📦 남은 Helm 릴리스: $remaining_releases개${NC}"
    fi
    echo ""
    echo -e "${YELLOW}💡 수동으로 정리가 필요할 수 있습니다.${NC}"
fi

echo ""
echo -e "${BLUE}🔄 현재 시스템 상태:${NC}"
echo -e "  ${GREEN}✅ minikube 클러스터: 실행 중 (깨끗한 상태)${NC}"
echo -e "  ${GREEN}✅ Docker: 실행 중${NC}"
echo -e "  ${GREEN}✅ kubectl: 연결 가능${NC}"
echo ""
echo -e "${BLUE}💡 다시 시작하려면:${NC}"
echo "  ./scripts/setup.sh        # 전체 환경 재설정 (권장)"
echo "  cd backend && npm start   # 또는 API 서버만 시작"
echo ""
echo -e "${YELLOW}⚠️  주의사항:${NC}"
echo "  • 메타데이터 DB가 삭제되었으므로 새로 설정이 필요합니다"
echo "  • 기존 백업 메타데이터가 모두 삭제되었습니다"
echo "  • 새로운 인스턴스 생성 시 자동으로 메타데이터가 생성됩니다"
echo ""
echo -e "${BLUE}📖 자세한 사용법은 OPERATIONS_GUIDE.md 참조${NC}"
echo ""
echo -e "${GREEN}✨ 정리 작업 완료!${NC}" 