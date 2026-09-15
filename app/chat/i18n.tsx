"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "zh";

const english: Record<string, string> = {
  "识别到一个高风险投诉。": "A high-risk complaint has been identified.",
  "客户廖女士于 2026 年 4 月 1 日在珠海锦泰宝汇购买 BMW X5，提车当天回家路上出现发动机抖动。经销商初步判断为点火线圈故障并建议维修，但客户认为新车存在质量问题，不接受维修并明确要求退车。": "Ms. Liao purchased a BMW X5 from Zhuhai Jintai Baohui on April 1, 2026. The engine began vibrating on her way home on the delivery day. The dealer's initial diagnosis was an ignition-coil fault and they recommended repair, but the customer believes the new vehicle has a quality defect, declines repair, and explicitly requests a return.",
  "要求补充更多信息": "Request More Information",
  "高风险投诉调查｜廖女士": "High-risk Complaint Investigation | Ms. Liao",
  "Compliant Investigation 已启动。我会先核实车辆故障、经销商检查结论与客户退车诉求，并在需要业务确认时发起补充信息请求。": "Compliant Investigation has started. I will verify the vehicle fault, the dealer's findings, and the customer's return request, and request additional information when business confirmation is needed.",
  "请补充经销商完整检测报告、维修工单、车辆当前里程，以及客户是否已提交书面退车申请。收到后，我会更新投诉风险判断与调查建议。": "Please provide the dealer's complete diagnostic report, repair order, current vehicle mileage, and whether the customer has submitted a written return request. I will then update the risk assessment and investigation recommendation.",
  "识别客户投诉中的风险信号，汇总客户、车辆与经销商信息，并提出下一步处理建议。": "Identify risk signals in the complaint, consolidate customer, vehicle, and dealer information, and recommend the next step.",
  "客户来电转写、车辆 VIN 与客户主数据": "Customer call transcript, vehicle VIN, and customer master data",
  "识别投诉风险，保留客户原话，并决定是否启动投诉调查流程。": "Identify complaint risk, preserve the customer's original words, and determine whether to start the complaint investigation process.",
  "等待业务人员确认后，启动投诉调查并编排所需的信息补充与事实核验。": "Wait for business confirmation, then start the complaint investigation and orchestrate the required information collection and fact verification.",
  "高风险投诉摘要与业务人员确认": "High-risk complaint summary and business confirmation",
  "收到确认后启动投诉调查；如信息不足，先列出需要补充的材料。": "Start the complaint investigation after confirmation; if information is insufficient, list the required materials first.",
  "提交 Dealer 补件": "Submit Dealer Documents",
  "请从左侧当前任务提交 CCO 回写。": "Submit the CCO update from the active task on the left.",
  "点击节点查看计划与执行记录": "Select a node to view its plan and activity",
  "关闭 CCO 回写": "Close CCO update",
  "资料状态": "Document status",
  "需要补充资料": "Additional documents required",

  "调用关系": "Call graph",
  "个节点": "nodes",
  "系统与数据源": "Systems & data",
  "编排画布，可滚动查看": "Orchestration canvas, scroll to explore",
  "数据连接": "Data connection",
  "箭头表示调用方向": "Arrows show the call direction",
  "数据查询": "Data query",
  "流程委派": "Process handoff",
  "执行计划": "Execution plan",
  "编辑执行计划": "Edit execution plan",
  "参考来源": "Sources",
  "执行过程": "Execution activity",
  "模拟记录": "Simulated",
  "执行结果": "Result",
  "查看调用关系": "View call details",
  "模拟编排 · 点击节点查看计划与执行记录": "Simulated orchestration · Select a node to inspect",
  "已接收任务与案件上下文": "Task and case context received",
  "正在按计划处理": "Processing the execution plan",
  "已完成计划中的处理步骤": "Planned steps completed",
  "已返回执行结果": "Result returned",
  "新车交付当天出现发动机抖动，客户明确要求退车。已识别为高风险质量投诉，建议创建 CCO 案件。": "Engine vibration occurred on delivery day and the customer requested a return. Classified as a high-risk quality complaint; create a CCO case.",
  "已创建 CCO-CMP-2026-0096，并关联客户诉求和原始录音。": "Created CCO-CMP-2026-0096 and attached the customer request and original recording.",
  "已生成调查计划：查询维修记录、技术方案与代步车资源；按确认范围补充 Warranty 查询。": "Investigation plan prepared: retrieve repair history, technical solution and loaner availability. Add Warranty queries within the confirmed scope.",
  "4 月 4 日进店检查：二缸点火线圈工作不良，导致缺火抖动。": "April 4 inspection: a faulty cylinder 2 ignition coil caused misfire and vibration.",
  "4 月 7 日技术反馈：更换全部点火线圈，共 6 个。": "April 7 technical recommendation: replace all six ignition coils.",
  "经销商未来一周有一辆 BMW 5 系代步车可用。": "One BMW 5 Series loaner is available at the dealer for the coming week.",
  "FRD 保修开始日：2026 年 4 月 3 日；当前里程：91 km。": "FRD warranty start date: April 3, 2026. Current mileage: 91 km.",
  "已生成客户关怀方案：维修安排、代步车支持及一年延保，并准备客户沟通话术。": "Prepared a customer-care package covering repairs, a loaner and a one-year warranty extension, with a communication script.",
  "已接收 Dealer 材料并启动文档审核；回写仍需等待审核结果与人工批准。": "Dealer documents received and review started. CCO writeback still requires review results and human approval.",
  "已核对 3 份文件的 VIN、日期与签字，资料完整，可交由人工审批。": "Checked VIN, dates and signatures across three documents. The complete package is ready for human approval.",
  "审批通过后已回写 CCO，收到成功回执 WR-2026-0068。": "Wrote the approved decision to CCO and received confirmation WR-2026-0068.",
  "客户授权签字缺失，审核已暂停。等待 Dealer 补件后重新核验，当前不能批准。": "Customer authorization signature is missing. Review is paused pending dealer supplements; approval is not yet possible.",

  "我已经听完这段投诉电话。廖女士描述，她于 2026 年 4 月 1 日在珠海锦泰宝汇购买 BMW X5，提车当天回家路上便出现发动机抖动。\n\n这是一项发生在新车交付当天的质量投诉，且客户已明确提出退车。为了完整保留录音、经销商检查结论和客户诉求，我建议先创建 CCO 高风险退车投诉案例，用于跟进当前客诉。": "I have finished reviewing the complaint call. Ms. Liao said she purchased a BMW X5 from Zhuhai Jintai Baohui on April 1, 2026, and noticed engine vibration on the way home the same day.\n\nThis is a quality complaint that occurred on the day a new vehicle was delivered, and the customer has explicitly requested a return. To preserve the recording, dealer findings, and customer request in full, I recommend creating a high-risk CCO vehicle-return complaint case to track this issue.",
  "CCO-CMP-2026-0096 已创建，客户原话、经销商初步检查结论和退车诉求均已归入案件。\n\n我优先推荐启动客户挽留流程。车辆为新车，且故障发生在交付当天；在已有初步处理方向的情况下，先围绕客户的质量担忧提供解决方案，更有机会恢复客户信心，也有助于避免不必要的业务损失。\n\n同时，客户已经明确提到退车，因此也可以直接进入退车流程；该诉求会被完整保留，不会因启动挽留流程而被覆盖。": "CCO-CMP-2026-0096 has been created. The customer's original statement, the dealer's initial findings, and the return request are now recorded in the case.\n\nI recommend starting with the customer retention process. This is a new vehicle and the issue occurred on the delivery date. Since an initial resolution direction is already available, addressing the customer's quality concerns first is more likely to restore confidence and avoid unnecessary business loss.\n\nThe customer has also explicitly requested a return, so the vehicle-return process remains available. That request is preserved in full and will not be overridden by starting retention.",
  "我推荐按下面的顺序执行。\n\n客户在购车当日就发现故障，因此先核实购车日附近的维修工单，确认客户提供的故障信息与经销商记录是否一致。随后查询已登记的维修方案，明确后续修复安排。\n\n维修期间的出行安排也会影响客户是否愿意继续沟通，因此我会查询经销商是否有可用代步车。": "I recommend proceeding in the sequence below.\n\nBecause the issue was noticed on the purchase date, first review repair orders around that date to confirm whether the customer's account matches the dealer records. Then retrieve the registered repair solution to establish the repair arrangement.\n\nMobility during the repair may also affect the customer's willingness to continue the discussion, so check whether the dealer has a loaner vehicle available.",
  "审批已完成。客户投诉的质量问题属实，已有对应的维修方案，未来一周可提供代步车；结合 FRD 与当前里程，车辆属于新车。\n\n接下来建议基于车型、质量问题和已确认的维修资源，生成客户补偿方案及对应沟通话术。": "The approvals are complete. The reported quality issue is substantiated, a corresponding repair solution is available, and a loaner vehicle can be provided during the coming week. The FRD and current mileage also confirm that this is a new vehicle.\n\nNext, I recommend generating an appropriate customer-care package and communication script based on the model, the quality issue, and the confirmed service resources.",
  "Customer Care Knowledge Agent 已基于已审批的车辆信息、质量问题、维修方案和代步车资源生成客户补偿方案与沟通话术。\n\n我建议在完成全部 6 个点火线圈更换的基础上，为廖女士提供发动机一年延保、一次火花塞保养、两次机油保养，并在维修期间安排一辆 5 系代步车。\n\n建议 Customer Care 使用以下话术：\n\n“廖女士，我们确认您的车辆在交付后很快出现了点火系统故障。我们将完成全部 6 个点火线圈的更换；维修期间为您安排 5 系代步车。为回应您对新车可靠性和后续使用的担忧，我们还将提供发动机一年延保、一次火花塞保养和两次机油保养。您可以了解方案后，再决定是否接受。”": "The Customer Care Knowledge Agent has generated a customer-care package and communication script using the approved vehicle details, quality issue, repair solution, and loaner availability.\n\nIn addition to replacing all six ignition coils, I recommend offering Ms. Liao a one-year engine warranty extension, one spark-plug service, two oil services, and a BMW 5 Series loaner during the repair.\n\nRecommended Customer Care script:\n\n“Ms. Liao, we have confirmed that your vehicle developed an ignition-system fault shortly after delivery. We will replace all six ignition coils and provide a BMW 5 Series loaner during the repair. To address your concerns about the reliability and future use of your new vehicle, we will also provide a one-year engine warranty extension, one spark-plug service, and two oil services. Please review the package before deciding whether to accept it.”",
  "我已将 FRD 保修开始日和当前里程加入待执行计划。它们会与购车日附近的维修工单、维修方案和代步车可用性一并核对；目前尚未发起数据查询。下面是更新后的计划，请确认后开始执行。": "I have added the FRD warranty start date and current mileage to the pending plan. They will be checked together with repair orders around the purchase date, the repair solution, and loaner availability. No data query has been started yet. Please confirm the updated plan before execution.",
  "客户（廖女士）：我 4 月 1 日在珠海锦泰宝汇买了一辆 BMW X5，今天刚提车回家，路上就发现发动机一直抖动。\n\nST：我们已经收到您的反馈。车辆现在已经送回经销商了吗？\n\n客户：是的，送回去检查了。他们说是点火线圈故障，需要换点火线圈。新车第一天就出这种问题，我认为是车辆质量有问题。\n\nST：我会完整记录本次投诉和经销商的检查结论。\n\n客户：我不接受维修，我要求退车。请尽快告诉我怎么处理。": "Customer (Ms. Liao): I bought a BMW X5 from Zhuhai Jintai Baohui on April 1. On the way home after taking delivery today, I noticed that the engine kept vibrating.\n\nST: We have received your feedback. Has the vehicle been returned to the dealer?\n\nCustomer: Yes. They inspected it and said an ignition coil had failed and needed replacement. A new vehicle should not have this problem on day one. I believe this is a vehicle quality issue.\n\nST: I will record your complaint and the dealer's inspection findings in full.\n\nCustomer: I do not accept a repair. I want to return the vehicle. Please tell me how this will be handled as soon as possible.",
  "客诉接入与分类": "Complaint Intake & Classification", "客诉分类": "Complaint Classification", "风险与诉求分类": "Risk & Request Classification", "创建 CCO 投诉": "Create CCO Complaint",
  "客户维修挽留": "Customer Repair Retention", "维修挽留": "Repair Retention", "案件调查": "Case Investigation", "维修挽留方案": "Retention Solution", "客户确认": "Customer Confirmation",
  "CCA Case 审批": "CCA Case Approval", "CCA 审批": "CCA Approval", "创建 CCA Case": "Create CCA Case", "资料审核": "Document Review", "审批完成": "Approval Complete",
  "后台处理完成｜来电已转写并完成风险识别": "Background processing complete | Call transcribed and risk identified",
  "请创建 CCO 投诉，并告诉我接下来如何处理": "Create a CCO complaint and tell me how to proceed", "请创建 CCO 投诉": "Create CCO Complaint", "启动维修挽留流程": "Start Repair Retention Process", "按建议运行调查": "Run Investigation as Recommended", "启动 CCA 审批": "Start CCA Approval", "批准并回写结果": "Approve and Write Back Result",
  "启动客户挽留流程": "Start Customer Retention Process", "启动退车流程": "Start Vehicle Return Process", "按建议开始": "Start as Recommended",
  "确认生成客户补偿方案与沟通话术": "Generate Customer-Care Package and Script", "沟通完成，客户接受方案": "Customer contacted and accepted the package", "客户仍要求退车": "Customer still requests a return",
  "我已按确认后的计划启动 Data Agent 查询。": "I have started the Data Agent queries according to the confirmed plan.",
  "Repair History Data Agent 返回：4 月 4 日有进店记录，检测发现二缸点火线圈工作不良，导致缺火抖动。": "Repair History Data Agent result: A workshop visit was recorded on April 4. The diagnosis found that a malfunctioning ignition coil on cylinder 2 caused a misfire and vibration.",
  "Technical Service Data Agent 返回：4 月 7 日反馈，更换所有点火线圈（6 个）。": "Technical Service Data Agent result: On April 7, the recommendation was to replace all six ignition coils.",
  "Mobility Data Agent 返回：未来一周有一辆 5 系代步车可以使用。": "Mobility Data Agent result: One BMW 5 Series loaner is available during the coming week.",
  "Warranty Data Agent 返回：FRD 保修开始日为 2026 年 4 月 3 日，当前里程为 91 km。": "Warranty Data Agent result: The FRD warranty start date is April 3, 2026, and the current mileage is 91 km.",
  "核实故障事实": "Verify the reported issue", "查询购车日附近的维修工单": "Retrieve repair orders around the purchase date", "确认故障记录与客户描述是否一致": "Confirm whether dealer records match the customer's account",
  "确认修复安排": "Confirm the repair arrangement", "查询已登记的维修方案": "Retrieve the registered repair solution", "明确后续维修安排": "Establish the subsequent repair arrangement",
  "确认出行保障": "Confirm mobility support", "查询经销商是否有可用代步车": "Check dealer loaner availability", "明确维修期间的出行支持条件": "Confirm mobility support during the repair",
  "确认新车状态": "Confirm new-vehicle status", "查询 FRD 保修开始日与当前里程": "Retrieve FRD warranty start date and current mileage", "补充车辆状态判断依据": "Add objective evidence for vehicle status",
  "任务管理": "Task Management", "流程管理": "Process Management", "权限管理": "Access Management", "主菜单": "Main navigation",
  "任务中心": "Task Center", " 个任务": " tasks", "新建任务": "New Task", "进行中": "In Progress", "待处理": "Pending", "已完成": "Completed", "需审批": "Approval Required", "已审批": "Approved", "已转出": "Transferred", "等待审批": "Awaiting Approval", "等待 Customer Care": "Awaiting Customer Care", "等待外部": "Awaiting External Action", "处理中": "In Progress",
  "展开完整列表": "Show All Tasks", "收起任务列表": "Collapse Task List", "任务列表": "Task list", "关闭任务列表": "Close task list", "打开任务列表": "Open task list",
  "AI 识别高风险投诉｜廖女士": "AI-identified high-risk complaint | Ms. Liao", "高风险投诉待启动挽留｜廖女士": "High-risk complaint awaiting retention | Ms. Liao", "高风险投诉调查中｜廖女士": "High-risk complaint under investigation | Ms. Liao", "高风险投诉等待跨部门审批｜廖女士": "High-risk complaint awaiting cross-functional approval | Ms. Liao", "维修挽留等待 Customer Care 反馈｜廖女士": "Repair retention awaiting Customer Care feedback | Ms. Liao", "客户已接受，等待 Dealer 上传材料｜廖女士": "Customer accepted; awaiting dealer documents | Ms. Liao", "CCA 案件审批｜廖女士｜CCA-2026-0068": "CCA case approval | Ms. Liao | CCA-2026-0068", "高风险投诉案件｜廖女士": "High-risk complaint case | Ms. Liao",
  "延保资料待补充｜CCA-2026-0041": "Warranty-extension documents pending | CCA-2026-0041", "零件延迟投诉｜CCO-CMP-0087": "Parts-delay complaint | CCO-CMP-0087", "道路救援费用核验｜王先生": "Roadside-assistance fee review | Mr. Wang", "重复维修客户关怀｜李女士": "Repeat-repair customer care | Ms. Li", "代步车权益确认｜CCO-CMP-0102": "Loaner eligibility confirmation | CCO-CMP-0102", "Dealer 沟通记录待补充｜赵先生": "Dealer contact record pending | Mr. Zhao", "维修方案技术复核｜BMW X5": "Technical review of repair solution | BMW X5", "客户授权文件待签署｜CCA-2026-0071": "Customer authorization awaiting signature | CCA-2026-0071",
  "维修关怀已完成｜CCA-2026-0032": "Repair-care task completed | CCA-2026-0032", "客户回访已完成｜CCO-CMP-0068": "Customer follow-up completed | CCO-CMP-0068", "零件加急调拨完成｜刘先生": "Urgent parts transfer completed | Mr. Liu", "延保申请审批完成｜CCA-2026-0029": "Warranty-extension approval completed | CCA-2026-0029", "投诉分类与转派完成｜CCO-CMP-0054": "Complaint classified and routed | CCO-CMP-0054",
  "客户信息": "Customer Information", "正在识别客户信息…": "Identifying customer information…", "廖女士 · BMW X5": "Ms. Liao · BMW X5", "联系电话": "Phone", "经销商": "Dealer", "珠海锦泰宝汇": "Zhuhai Jintai Baohui", "识别中": "Identifying",
  "AI 协作对话": "AI Collaboration", "业务指令": "Business instruction", "上传附件": "Upload attachment", "发送指令": "Send instruction",
  "等待 CCO 回写后继续": "Waiting for CCO update", "等待审批任务完成": "Waiting for approval tasks", "当前步骤无需输入": "No input is required at this step", "可补充信息，或按建议开始": "Add information or start as recommended",
  "等待 Customer Care 与客户线下沟通": "Waiting for Customer Care to contact the customer", "沟通完成后，请在下方直接输入客户是否接受方案。": "After the conversation, enter whether the customer accepted the package below.",
  "等待 Dealer 线下处理": "Waiting for offline dealer action", "请从左侧当前任务使用带 Mock 标识的 CCO 回写。": "Use the Mock CCO update in the active task on the left.", "主任务已暂停": "Main task paused", "请完成左侧仍待处理的跨部门审批任务。": "Complete the remaining cross-functional approval tasks on the left.",
  "客户与 ST 原始录音": "Original Customer–ST Recording", "客户与 ST 的原始通话录音": "Original call between customer and ST", "播放原始录音": "Play original recording", "暂停原始录音": "Pause original recording", "录音转写": "Transcript",
  "目标": "Objective", "执行动作": "Action", "预期产出": "Expected Output", "AI 建议操作": "AI suggested actions",
  "当前流程进度": "Current process progress", "当前 Process": "Current Process", "历史记录": "History", "只读": "Read-only",
  "AI Agent编排器": "AI Agent Orchestrator", "展开编排": "Expand orchestration", "展开 Agent 编排": "Expand Agent orchestration", "调整编排": "Edit orchestration", "关闭 Agent 区": "Close Agent panel",
  "执行中": "Running", "完成": "Complete", "运行中": "Running", "等待": "Waiting", "已返回": "Returned", "调用中": "Calling", "待调用": "Pending Call",
  "调用链路": "Call Flow", "已返回 ·": "returned ·", "Agent 调用关系": "Agent call relationships",
  "Repair History Data Agent 请求业务审批｜4/4 维修记录": "Repair History Data Agent requests approval | Apr 4 repair record", "Technical Service Data Agent 请求业务审批｜4/7 维修方案": "Technical Service Data Agent requests approval | Apr 7 repair solution", "Mobility Data Agent 请求业务审批｜代步车可用性": "Mobility Data Agent requests approval | Loaner availability", "Warranty Data Agent 请求业务审批｜FRD 与里程": "Warranty Data Agent requests approval | FRD and mileage",
  "Repair History 已确认｜维修记录": "Repair History approved | Repair record", "Technical Service 已确认｜维修方案": "Technical Service approved | Repair solution", "Mobility 已确认｜代步车安排": "Mobility approved | Loaner arrangement", "Warranty 已确认｜FRD 与里程": "Warranty approved | FRD and mileage",
  "审批": "Approve", "审批任务": "Approval Task", "返回主任务": "Back to Main Task", "高风险投诉案件": "High-risk Complaint Case", "基本信息": "Basic Information", "客户": "Customer", "廖女士": "Ms. Liao", "车型": "Model", "当前里程": "Current Mileage", "查询原因": "Reason for Query", "查询结果": "Query Result", "确认数据并继续": "Confirm Data and Continue", "要求补充证据": "Request Supporting Evidence", "请补充说明证据来源": "Please provide the evidence source", "审批意见": "Approval comment", "审批意见已记录": "Approval recorded", "上传审批附件": "Upload approval attachment", "审批流程进度": "Approval progress", "当前审批任务": "Current Approval Task", "已确认": "Approved", "已附加": "Attached", "例如": "Example", "我确认": "I confirm", "的数据，可以继续": " data; proceed", "发送": "Send", "编辑": "Edit",
  "收到，我已经记录你的审批意见。请继续完成左侧其余 Agent 结果的审批。": "Received. I have recorded your approval. Please complete the remaining Agent-result approvals on the left.",
  "4 月 4 日有进店记录，检测发现二缸点火线圈工作不良，导致缺火抖动。": "A workshop visit was recorded on April 4. A malfunctioning ignition coil on cylinder 2 caused a misfire and vibration.", "4 月 7 日技术反馈为更换所有点火线圈（6 个）。": "The April 7 technical recommendation was to replace all six ignition coils.", "未来一周有一辆 5 系代步车可以使用。": "One BMW 5 Series loaner is available during the coming week.", "FRD 保修开始日为 2026 年 4 月 3 日，当前里程为 91 km。": "The FRD warranty start date is April 3, 2026, and the current mileage is 91 km.",
  "客户在购车当日提出发动机抖动投诉，需要查询购车日附近的维修记录，核实客户描述是否与经销商记录一致。": "The customer reported engine vibration on the purchase date. Repair records around that date were queried to verify whether her account matches the dealer records.", "客户挽留方案需要以已登记的修复安排为基础，因此查询当前技术维修方案。": "The retention approach must be based on a registered repair arrangement, so the current technical repair solution was queried.", "维修期间的出行支持会影响客户是否接受挽留方案，因此查询经销商的代步车可用性。": "Mobility support during the repair may affect acceptance of the retention approach, so dealer loaner availability was queried.", "该查询由业务人员补充，用于核实车辆的新车状态，并为当前案件提供车辆状态依据。": "This query was added by the business user to verify new-vehicle status and provide objective vehicle-status evidence for the case.",
  "可用节点": "Available Nodes", "历史流程不可修改。": "Historical processes cannot be edited.", "按当前 Process 添加系统或数据源。": "Add systems or data sources to the current Process.", "节点详情": "Node Details", "计划输入": "Planned Input", "请求输入": "Request Input", "尚未发送调用，不展示返回结果。": "The call has not been sent, so no result is shown.", "请求已发出，正在等待 Agent 返回。": "Request sent; waiting for the Agent response.", "Agent 已返回；点击对应节点查看结果和依据。": "The Agent has returned. Select the node to review its result and evidence.", "它刚刚接到的任务": "Latest Task", "它是怎么回答的": "Agent Response", "它参考了这些内容": "Evidence Used", "正在处理": "Processing", "尚未执行": "Not Started", "现在的状态": "Current Status", "已连接": "Connected", "保存编排": "Save Orchestration", "返回当前流程": "Back to Current Process", "个节点 · 自动连线": " nodes · auto-connected",
  "自动分类准确率": "Auto-classification Accuracy", "平均节省时间": "Average Time Saved", "原话可追溯": "Original Statement Traceability", "人工检索减少": "Manual Lookups Reduced", "自动核验问题": "Checks Automated", "单案节省时间": "Time Saved per Case", "资料预审提速": "Document Prescreening Gain", "自动核验文件": "Documents Auto-checked", "审批证据留痕": "Approval Evidence Retained",
  "我已收到你的补充：": "I have received your additional instruction: ",
  "我在原话里听到了三个需要立即升级的信号：行驶中失去动力、同一问题修了五次、客户明确要求退车。综合判断，这是高风险投诉，建议先创建 CCO 案件保留原始语境。": "The customer's own words contain three signals requiring immediate escalation: loss of power while driving, five repair attempts for the same issue, and an explicit vehicle-return request. Taken together, this is a high-risk complaint, so I recommend creating a CCO case that preserves the original context.",
  "本次电话逐字稿、车辆 VIN 与客户主数据": "Call transcript, vehicle VIN, and customer master data", "先完整听完来电，保留客户原话；再判断诉求、风险和应进入的业务流程。": "Review the complete call and preserve the customer's own words before determining the request, risk, and appropriate business process.",
  "将客户原话、基础信息和投诉诉求写入 CCO，并创建当前投诉案件。": "Write the customer's original statement, basic details, and complaint request into CCO and create the complaint case.", "已完成风险识别的投诉内容": "Complaint content with completed risk identification", "创建 CCO 投诉案件，并保留原始录音与客户诉求。": "Create the CCO complaint case and retain the original recording and customer request.",
  "根据客户确认的计划，编排维修记录、技术方案和代步车查询；如业务人员补充新车状态核验，再加入 Warranty Data Agent。": "Orchestrate repair-history, technical-solution, and loaner queries according to the confirmed plan. Add the Warranty Data Agent only if the business user requests new-vehicle verification.", "当前 CCO 投诉与用户确认的执行计划": "Current CCO complaint and user-confirmed execution plan", "基于已确认的计划调用所需 Data Agents，并汇总可供客户沟通的事实。": "Call the required Data Agents from the confirmed plan and consolidate facts suitable for customer communication.",
  "查询购车日附近的进店与维修记录，核实客户所述故障。": "Retrieve workshop and repair records around the purchase date to verify the reported issue.", "Dealer 维修工单": "Dealer repair orders", "查询 4 月 1 日至 4 月 8 日的维修工单，返回诊断结论。": "Retrieve repair orders from April 1 through April 8 and return the diagnosis.",
  "查询已登记的维修方案，明确车辆的修复安排。": "Retrieve the registered repair solution and establish the vehicle repair arrangement.", "Technical Service 维修方案": "Technical Service repair solution", "返回当前已登记的点火系统维修方案。": "Return the currently registered ignition-system repair solution.",
  "查询经销商未来一周的可用代步车。": "Check the dealer's available loaner vehicles for the coming week.", "Dealer Mobility 库存": "Dealer Mobility inventory", "确认未来一周是否有可用的同级代步车。": "Confirm whether a comparable loaner is available during the coming week.",
  "仅在业务人员补充后，查询 FRD 保修开始日和当前里程以核实新车状态。": "Only after a business-user addition, retrieve the FRD warranty start date and current mileage to verify new-vehicle status.", "FRD 与车辆里程数据": "FRD and vehicle mileage data", "返回 FRD 保修开始日及当前里程。": "Return the FRD warranty start date and current mileage.",
  "基于已确认的车辆、质量问题和服务资源，生成客户补偿方案与沟通话术。": "Generate a customer-care package and communication script from the confirmed vehicle, quality issue, and service resources.", "已审批的 Agent 查询结果与客户关怀知识库": "Approved Agent-query results and Customer Care knowledge base", "生成与当前客户投诉相匹配的补偿方案及 Customer Care 沟通话术。": "Generate a customer-care package and Customer Care script suited to this complaint.",
  "3.2 分钟": "3.2 min", "11 分钟": "11 min", "5 个": "5", "3 份": "3",
  "编排": "Orchestration", "连接": "Connection", "创建 CCO 投诉案件": "Create CCO complaint case", "已识别的客户投诉与原始录音": "Identified customer complaint and original recording", "生成客户补偿方案与沟通话术": "Generate customer-care package and script", "已审批的维修、代步车与 Warranty 结果": "Approved repair, loaner, and Warranty results", "委派 CCA 审批任务": "Delegate CCA approval task", "待审核材料": "Documents pending review", "核验 CLAIM 文件": "Review CLAIM documents", "Dealer 上传的申请表、维修单和授权文件": "Dealer-uploaded application, repair order, and authorization", "审批完成后回写 CCO": "Write back to CCO after approval", "审批决定": "approval decision", "连接系统 / 数据源": "Connect system / data source", "当前案件上下文": "Current case context", "购车日附近维修工单": "repair orders around purchase date", "已登记维修方案": "registered repair solution", "未来一周代步车": "loaner availability for the coming week", "FRD 保修开始日": "FRD warranty start date",
  "浅色": "Light", "深色": "Dark", "深色模式": "Dark mode", "切换到浅色模式": "Switch to light mode", "切换到深色模式": "Switch to dark mode", "通知": "Notifications", "账户": "Account",
  "新建客户关怀任务｜待补充信息": "New customer-care task | Information required", "模拟维修与 CLAIM 回写": "Simulate Repair & CLAIM Update", "模拟 Dealer 补件": "Simulate Dealer Supplement",
  "车辆维修记录查询｜新任务": "Vehicle Repair History Query | New Task", "车辆维修记录查询": "Vehicle Repair History Query", "自然语言任务进度": "Natural-language task progress", "当前任务": "Current Task", "自然语言数据查询": "Natural-language Data Query", "描述查询需求": "Describe Request", "动态编排 Agent": "Dynamically Orchestrate Agent", "返回查询结果": "Return Results",
  "描述你的任务": "Describe your task", "系统会理解你的自然语言，并在需要时动态添加合适的 Agent。": "The workbench will interpret your natural-language request and dynamically add the appropriate Agent when needed.", "请提供车辆标识，并明确需要查询维修记录。": "Provide a vehicle identifier and specify that you want its repair history.",
  "我识别到这是车辆维修历史查询。已根据你的需求动态加入 Repair History Data Agent，正在查询全部维修工单。": "I identified this as a vehicle repair-history query. I dynamically added the Repair History Data Agent for this request, and it is now retrieving all repair orders.", "正在查询": "Querying", "Repair History Data Agent 已完成查询。我按时间顺序整理了 ": "The Repair History Data Agent has completed the query. I organized all repair records for ", " 的全部维修记录，共 ": " in chronological order. Total: ", " 条。": " records.",
  "例如：帮我查询 XXX 车的所有维修记录": "Example: Find all repair records for vehicle XXX", "日期": "Date", "里程": "Mileage", "类型": "Type", "维修记录": "Repair Record", "状态": "Status", "故障诊断": "Fault Diagnosis", "维修作业": "Repair Work", "质量检查": "Quality Check", "检测发现二缸点火线圈工作不良，导致缺火抖动。": "A malfunctioning ignition coil on cylinder 2 was found to be causing a misfire and vibration.", "更换全部点火线圈（6 个）。": "Replaced all six ignition coils.", "完成故障码清除及道路测试，发动机运行正常。": "Cleared fault codes and completed a road test; the engine operated normally.",
  "已按用户提供的车辆标识查询全部维修记录，并将工单按时间顺序整理。": "Queried all repair records using the vehicle identifier provided by the user and organized the repair orders chronologically.", "Dealer Repair History 数据源与维修工单": "Dealer Repair History data source and repair orders", "识别用户指定的车辆，查询全部维修记录，并以结构化表格返回。": "Identify the vehicle specified by the user, retrieve all repair records, and return them in a structured table.", "正在识别车辆标识并查询全部维修工单。": "Identifying the vehicle and retrieving all repair orders.", "已查询 ": "Queried ", " 的全部维修记录，共返回 ": ", returning all repair records: ", "查询 ": "Retrieve all repair records for ", " 的全部维修记录，并按时间顺序返回。": " and return them chronologically.",
  "维修与 CLAIM 回写": "Repair & CLAIM Update", "Dealer 补件回写": "Dealer Supplement Update", "车辆维修与一年延保已完成": "Vehicle repair and one-year warranty extension completed", "Dealer 将维修单和 CLAIM 文件回写 CCO。": "The dealer will send the repair order and CLAIM documents back to CCO.", "演示资料状态": "Demo Document Status", "资料完整": "Documents Complete", "进入正常审批": "Proceed to Standard Approval", "缺少授权签字": "Missing Authorization Signature", "演示补件路径": "Demo Supplement Path", "客户授权文件已补充": "Customer authorization document added", "提交后将重新触发 OCR 审核。": "Submitting will trigger OCR review again.", "取消": "Cancel", "提交 CCO 回写": "Submit CCO Update"
};

export function translateText(value: string, locale: Locale) {
  if (locale === "zh" || !value) return value;
  if (english[value]) return english[value];
  return Object.entries(english)
    .sort(([a], [b]) => b.length - a.length)
    .reduce((result, [source, target]) => result.split(source).join(target), value);
}

type LanguageContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (value: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => { document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (text: string) => translateText(text, locale) }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();
  const englishActive = locale === "en";
  return <button type="button" className="language-toggle" onClick={() => setLocale(englishActive ? "zh" : "en")} aria-label={englishActive ? "切换为中文" : "Switch to English"} title={englishActive ? "切换为中文" : "Switch to English"}>
    <span aria-hidden="true">{englishActive ? "EN" : "中"}</span>
    <b>{englishActive ? "中文" : "EN"}</b>
  </button>;
}
