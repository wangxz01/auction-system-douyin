package controllers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "auction-system",
		"time":    time.Now().Format(time.RFC3339),
	})
}

/*
================================================================================
【本文件作用】backend/controllers/health_controller.go（健康检查控制器）
================================================================================
作用：实现 /health 接口的具体逻辑，返回服务存活状态。

什么是 controller（控制器）：
  在 MVC（Model-View-Controller）架构里，controller 负责"接受请求 → 调用
  业务逻辑 → 返回响应"。本项目用 controllers/ 目录存放所有接口处理函数。

健康检查接口的用途：
  1. 运维：监控系统（Prometheus、k8s liveness probe）定期访问，判断服务是否存活
  2. 开发：本地启动后 curl 一下，确认服务跑起来了
  3. 联调：前端用这个接口测试是否能正常调通后端（本项目当前用途）

返回字段说明：
  status   "ok" 表示服务正常
  service  服务名，多服务架构下区分是哪个服务
  time     当前服务器时间，能顺便看出服务器时区是否正确

后续扩展：
  生产环境的健康检查通常会加入对依赖的检查，比如：
    - MySQL 能不能 ping 通
    - Redis 能不能 ping 通
  这样监控系统才能发现"服务进程活着但数据库挂了"的情况。
================================================================================
*/

