# Building a Mini DBaaS with Kubernetes: A DBA's Cloud-Native Engineering Journey

## Why Did I Build This?

As a Database Administrator (DBA), I've always been curious about how cloud database services like AWS RDS work internally. Rather than just being a consumer of such services, I wanted to understand the engineering challenges of building a Database-as-a-Service (DBaaS) platform.

I was particularly fascinated by **AWS Aurora MySQL's fast snapshot creation and cluster restoration capabilities**, and wanted to implement these advanced features myself. I also wanted to build a complete DBaaS platform that supports various databases (PostgreSQL, MySQL, MariaDB) with high availability and automatic failover capabilities.

### 🎯 **Development Motivation and Goals**
- **Node.js Learning**: Hands-on project to strengthen backend development capabilities
- **Kubernetes Understanding**: Acquiring cloud-native technologies as a DBA
- **AWS Aurora-style Feature Implementation**: Fast snapshots and cluster restoration
- **High Availability System Construction**: HA clusters with automatic failover
- **Scaling Feature Implementation**: Dynamic resource allocation and horizontal/vertical scaling
- **Restoration Feature Implementation**: AWS Aurora-style fast restoration and cross-instance restoration
- **Multi-Database Support**: Integrated management of PostgreSQL, MySQL, MariaDB

### 💡 **Development Tool Investment**
Initially, my development skills were limited, so I invested about $40 to purchase **Cursor IDE**. This tool provides AI-based code generation and autocomplete features, which greatly helped in writing complex Kubernetes manifests and Node.js backend code. I was able to efficiently write complex YAML files like Helm chart templates and Kubernetes Operator configurations.

The goal was simple: **Build a fully functional DBaaS using Node.js and Kubernetes in just one week** to gain practical experience with cloud-native technologies and deepen my understanding of distributed systems.

## The Challenges

Building a DBaaS involves mastering several complex components:

- **Database Deployment Automation** (supporting multiple database types)
- **Multi-tenant Isolation** (proper resource management)
- **Backup and Recovery Systems** (point-in-time recovery)
- **High Availability Clustering** (automatic failure recovery)
- **Real-time Monitoring** and health checks
- **AWS Aurora-style Snapshot System** (fast backup/restoration)

## Major Problems I Encountered

### 1. Complexity of Kubernetes StatefulSets
Managing stateful databases in Kubernetes was trickier than expected. I had to learn:
- Persistent Volume Claims (PVC) for data persistence
- CSI VolumeSnapshots for backup/recovery
- Proper resource allocation and limits
- Namespace isolation for multi-tenancy

**Solution**: Created custom Helm charts with appropriate StatefulSet configurations for each database type.

### 2. Multi-Database Support and High Availability Implementation
Each database (PostgreSQL, MySQL, MariaDB) has different deployment patterns:
- **PostgreSQL**: Zalando PostgreSQL Operator for HA clusters (✅ Success)
- **MySQL/MariaDB**: Custom StatefulSet with monitoring exporters (❌ HA implementation failed)
- Different configuration requirements and connection patterns

**Solution**: Built an integrated API that abstracts database-specific differences while leveraging the advantages of each database type. For PostgreSQL, I successfully integrated the Zalando Operator, but MySQL HA cluster implementation was limited to single instances due to complexity.

### 3. AWS Aurora-style Backup and Recovery System
Implementing Aurora's fast snapshot creation and cluster restoration capabilities was a core goal:
- CSI VolumeSnapshots for storage-level backup
- Cross-instance backup restoration
- Backup verification and testing
- **5-10 second snapshot creation** (Aurora-level performance target)

**Solution**: Used CSI VolumeSnapshots with hostpath-driver for fast storage-level backup that works across all database types. I actually achieved Aurora-like fast backup performance (5-10 seconds) on empty databases.

### 4. High Availability Clustering (PostgreSQL vs MySQL)
I discovered interesting differences when setting up HA clusters with automatic failure recovery:

**PostgreSQL HA (✅ Success)**:
- Zalando PostgreSQL Operator integration
- Master/Replica service separation
- Automatic failure detection and recovery

**MySQL HA (❌ Failed)**:
- Percona XtraDB Cluster complexity
- Difficulty in Group Replication setup
- Limitations of Operator patterns

**Solution**: For PostgreSQL, I successfully integrated the Zalando PostgreSQL Operator for production-grade HA clusters with automatic failure recovery. MySQL is currently limited to single instances, with plans for HA implementation through MySQL Operator or Percona Operator in the future.

## What I Built

After one week of development, I had a working DBaaS platform with the following capabilities:

### ✅ **Completed Features**
- **Multi-Database Support**: PostgreSQL, MySQL, MariaDB instances
- **High Availability**: PostgreSQL HA clusters with automatic failure recovery
- **AWS Aurora-style Backup/Recovery**: CSI VolumeSnapshot-based fast snapshots (5-10 seconds)
- **RESTful API**: Complete CRUD operations for instance management
- **Real-time Monitoring**: Pod status, resource usage, health checks
- **Multi-tenant Isolation**: Namespace-based resource isolation
- **Resource Scaling**: Dynamic CPU/memory allocation

### 🚧 **Current Limitations**
- **No Web UI**: Currently CLI/API only (planned for Phase 1)
- **MySQL HA**: Only PostgreSQL HA clusters supported (limited due to MySQL HA implementation failure)
- **Monitoring**: Basic monitoring only (Prometheus/Grafana planned)
- **Security**: Basic authentication only (JWT/RBAC planned)
- **Multi-tenancy**: Basic namespace isolation only (advanced features planned)

### 📊 **Performance Metrics**
- **Backup Creation**: 5-10 seconds (Aurora level, empty database basis)
- **Database Restoration**: Within 30 seconds (empty database basis)
- **Instance Deployment**: Within seconds
- **HA Failover**: Automatic detection and recovery

> 💡 **Note**: Backup/restoration times are based on empty databases. In actual production environments, times may vary depending on data size.

## Technical Architecture

```
User Request → Node.js API → Kubernetes → Database Instances
                ↓
        CSI VolumeSnapshots (Aurora-style backup/recovery)
                ↓
    PostgreSQL HA Cluster (Zalando Operator)
                ↓
        Real-time Monitoring and Health Checks
```

### Technology Stack
- **Backend**: Node.js + Express
- **Orchestration**: Kubernetes + Helm
- **Databases**: PostgreSQL, MySQL, MariaDB
- **High Availability**: Zalando PostgreSQL Operator
- **Backup/Recovery**: CSI VolumeSnapshots (Aurora-style)
- **Monitoring**: Real-time pod/helm status tracking
- **Development Tools**: Cursor IDE (AI-based code generation)

## Key Learnings

### 1. Advanced Kubernetes Learning
- **StatefulSets** are powerful for database workloads but complex
- **CSI VolumeSnapshots** provide Aurora-level backup functionality
- **Namespace isolation** is crucial for multi-tenant environments
- **Resource quotas** prevent resource exhaustion

### 2. Database Operations in Kubernetes
- **Helm charts** make database deployment much easier
- **Operators** provide production-grade database management
- **Health checks** are essential for stable database operations
- **Configuration management through ConfigMaps** is elegant

### 3. Cloud-Native Patterns
- **API-first design** enables automation and integration
- **Event-driven architecture** improves scalability
- **Infrastructure as Code through Helm charts**
- **Observability through structured logging and metrics**

### 4. Importance of Development Tools
- **Cursor IDE's** AI-based code generation greatly helped with complex Kubernetes manifest writing
- **AI tool utilization** significantly improved development productivity and learning speed
- **Appropriate tool investment** plays a crucial role in project success

## Results

My mini DBaaS can now:
- Deploy PostgreSQL, MySQL, MariaDB instances in seconds
- Provide high-availability PostgreSQL clusters with automatic failure recovery
- **Create Aurora-style backups in 5-10 seconds** (goal achieved!, empty database basis)
- Restore databases within 30 seconds (empty database basis)
- Scale resources dynamically
- Monitor health and performance in real-time

## Next Steps

Based on this experience, I created a comprehensive roadmap for future improvements:

### Phase 1 (1-2 weeks)
- React web UI for visual management
- **MySQL HA Cluster Retry** (Percona XtraDB Operator or MySQL Operator)
- Prometheus + Grafana monitoring stack

### Phase 2 (3-4 weeks)
- Automated backup scheduling
- JWT-based authentication and RBAC
- Performance monitoring dashboard

### Phase 3 (5-8 weeks)
- Advanced multi-tenant features
- Security enhancements (encryption, audit logs)
- Cloud provider integration

## Why This Matters

This project taught me that building cloud services isn't just about technology, but understanding the operational challenges that arise when managing databases at scale. As a DBA, this experience provided:

- **Deep understanding of cloud-native architectures**
- **Practical experience with Kubernetes and containerization**
- **Insights into how cloud providers solve database challenges**
- **Confidence in handling complex distributed systems**
- **Experience with modern development methodologies using AI tools**

## Check It Out

The complete source code is available on GitHub:
**https://github.com/JungyeolHwang/DBaaS**

### Quick Start
```bash
# Clone repository
git clone https://github.com/JungyeolHwang/DBaaS.git
cd DBaaS

# Run setup script
./scripts/setup.sh

# Start API server
cd backend && npm start

# Create first database
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "name": "my-first-db",
    "config": {
      "password": "securepass123",
      "storage": "2Gi"
    }
  }'
```

## Conclusion

Building this mini DBaaS was an amazing learning experience. It showed that with the right tools and understanding, you can build production-ready database services even as side projects.

Investing in **Cursor IDE**, an AI tool, played a significant role in the project's success. I was able to efficiently write complex Kubernetes manifests and Node.js backend code, which was a great help in the early development stages.

Implementing **AWS Aurora-style fast snapshot functionality** was a core goal, and I achieved the target of 5-10 second backup creation using CSI VolumeSnapshots on empty databases. While actual production environments may have different backup times depending on data size, I was able to implement Aurora-like fast backup performance using storage-level snapshots. However, MySQL HA cluster implementation was more complex than expected, so currently only PostgreSQL is supported, but this is included in future improvement plans.

**High Availability System Construction** was successful for PostgreSQL through successful integration of the Zalando Operator for HA clusters with automatic failover. However, MySQL HA cluster implementation was more complex than expected, so currently only PostgreSQL is supported, but this is included in future improvement plans.

**Scaling features** and **fast restoration features** were also important goals. I implemented scaling through Kubernetes' dynamic resource allocation and achieved Aurora-like fast restoration performance using CSI VolumeSnapshots.

The journey from simple database management to cloud-native engineering was eye-opening. Kubernetes, Helm, and modern DevOps practices completely changed how I think about database operations.

For DBAs who want to expand their skills into cloud-native engineering, I strongly recommend building something similar. Start small, focus on core features, and gradually add complexity. And consider investing in appropriate development tools if needed!

**What will your next cloud-native project be?**

---

## Tags
#kubernetes #database #dba #cloud-native #nodejs #postgresql #mysql #mariadb #side-project #engineering #devops #cursor-ide #aws-aurora #ha-clustering

---

*This project was built as a learning exercise to understand cloud-native database services. Feel free to contribute, fork, or use as inspiration for your own projects!* 