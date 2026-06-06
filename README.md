# 城市更新居民签约全栈 Web 应用

## 项目概述

城市更新居民签约管理系统，用于管理城市更新过程中的房屋评估、补偿方案、异议处理、合同签约等全流程。

## 启动方式

### 方式一：使用启动脚本
```bash
./start.sh
```

### 方式二：分别启动前后端

**后端启动：**
```bash
cd backend
npm install
npm start
```
后端服务运行在 http://localhost:3002

**前端启动（开发模式）：**
```bash
cd frontend
npm install
npm run dev
```

### 默认账号
- 居民账号：`resident1` / 密码：`123456`
- 评估人员：`evaluator1` / 密码：`123456`
- 街道经办人：`handler1` / 密码：`123456`
- 法务：`legal1` / 密码：`123456`

## 主流程说明

### 核心流程
1. **居民提交房屋档案**：居民或经办人录入房屋基本信息
2. **评估人员保存评估结果**：评估人员对房屋进行价格评估
3. **生成补偿方案**：街道经办人基于评估结果生成补偿方案
4. **合同签约**：双方确认方案后签约
5. **数据库追踪签约意向**：全流程记录状态变更和审计日志

### 角色说明
| 角色 | 权限 |
|------|------|
| resident（居民） | 提交房屋档案、查看进度、提交异议 |
| evaluator（评估人员） | 创建和确认评估结果 |
| handler（街道经办人） | 管理房屋、生成方案、发起签约、台账归档 |
| legal（法务） | 处理异议、冻结合同、台账归档 |

## 新增功能：台账归档流程

### 功能概述
台账归档是签约完成后的收尾流程，用于将已签约的房屋档案、评估结果、补偿方案、合同进行统一归档管理。

### 归档前提条件
1. 房屋已完成签约（状态为 `signed`）
2. 不存在处理中的异议
3. 有已确认的评估结果和补偿方案

### 失败分支：异议处理中不能生成最终方案
在以下场景中，系统将阻止归档操作：
- 房屋存在状态为 `pending`（待处理）或 `processing`（处理中）的异议时，不能进行台账归档
- 错误提示：**"异议处理中不能生成最终方案，无法归档"**

### 台账归档功能特性

#### 1. 评估一致性检查
- 系统自动检查评估结果的一致性
- 支持按「评估一致/不一致」筛选归档记录
- 归档时默认标记 `evaluation_consistent = 1`（评估结果一致）

#### 2. 单条归档
- 在「待归档房屋」列表中，对单条已签约房屋执行归档
- 支持填写归档备注信息

#### 3. 批量归档
- 支持多选符合条件的房屋进行批量归档
- 批量操作时自动跳过不符合条件的房屋，并返回失败原因
- 失败原因包含：异议处理中、未签约、已存在归档记录等

#### 4. 归档记录查询
- 支持按归档状态筛选（全部/已归档/待归档/已取消）
- 支持按评估一致性筛选
- 支持按房屋编号、产权人模糊搜索
- 归档记录展示：归档编号、房屋信息、合同信息、评估总价、方案总价、补偿方式等

### 数据库变更

新增 `archives` 表：
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| house_id | TEXT | 关联房屋ID |
| contract_id | TEXT | 关联合同ID |
| evaluation_id | TEXT | 关联评估ID |
| scheme_id | TEXT | 关联方案ID |
| archive_no | TEXT | 归档编号（唯一） |
| archive_type | TEXT | 归档类型：normal（单条）/ batch（批量） |
| status | TEXT | 状态：pending/archived/cancelled |
| evaluation_consistent | INTEGER | 评估结果是否一致：1是/0否 |
| remark | TEXT | 归档备注 |
| archived_at | DATETIME | 归档时间 |
| created_by | TEXT | 创建人 |
| created_at | DATETIME | 创建时间 |

### API 接口

| 接口 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/houses/archives/list` | GET | 归档记录列表（支持筛选） | 全部角色 |
| `/api/houses/archives/:id` | GET | 归档详情 | 全部角色 |
| `/api/houses/:id/archives` | POST | 单条房屋归档 | handler / legal |
| `/api/houses/archives/batch` | POST | 批量归档 | handler / legal |
| `/api/houses/archives-consistency-check` | GET | 待归档房屋一致性检查 | handler / legal |

### 前端页面
- 新增「台账归档」菜单项，入口在左侧导航栏
- 页面包含：待归档房屋列表、筛选条件区、归档记录列表
- 支持批量归档弹窗操作

## 状态流转说明

### 房屋状态
```
draft（草稿）→ submitted（已提交）→ evaluating（评估中）→ evaluated（评估完成）
→ scheme_draft（方案草拟）→ scheme_confirmed（方案确认）→ objection（异议处理中）
→ contracting（签约中）→ signed（已签约）→ archived（已归档）
```

### 异议对流程的影响
- 异议提交后，房屋状态变为 `objection`
- 异议处理中（pending/processing）：不能生成最终方案、不能签约、不能归档
- 异议解决后，自动恢复到 `scheme_confirmed` 状态

## 技术栈

### 后端
- Node.js + Express
- sql.js（SQLite 数据库）
- JWT 认证
- bcryptjs 密码加密

### 前端
- React 18
- React Router
- Axios
- Vite 构建工具
