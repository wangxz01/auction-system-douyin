package controllers

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

// pageMeta 跟随每个分页接口的 `meta` 字段返回。
// 前端依据 total 决定是否还有下一页，依据 limit/offset 校验当前位置。
type pageMeta struct {
	Total  int64 `json:"total"`
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
}

// parsePagination 从 query 解析 limit / offset，带默认值与硬上限。
// 任何非法值都回到默认 limit；offset 负数归零。
func parsePagination(c *gin.Context, defaultLimit, maxLimit int) (limit, offset int) {
	limit = defaultLimit
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	return
}
