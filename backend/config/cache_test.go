package config

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCacheLoadJSONDedupsConcurrentLoads(t *testing.T) {
	t.Cleanup(func() { Redis = nil })
	Redis = nil

	var loaderCalls int32
	loader := func() (any, error) {
		atomic.AddInt32(&loaderCalls, 1)
		time.Sleep(50 * time.Millisecond)
		return map[string]int{"v": 42}, nil
	}

	var wg sync.WaitGroup
	const N = 20
	results := make([]map[string]int, N)
	wg.Add(N)
	for i := 0; i < N; i++ {
		go func(i int) {
			defer wg.Done()
			var dest map[string]int
			if err := CacheLoadJSON("stampede:test", time.Second, &dest, loader); err != nil {
				t.Errorf("CacheLoadJSON: %v", err)
				return
			}
			results[i] = dest
		}(i)
	}
	wg.Wait()

	if got := atomic.LoadInt32(&loaderCalls); got != 1 {
		t.Fatalf("loader executed %d times; want 1 (singleflight should dedupe)", got)
	}
	for i, r := range results {
		if r["v"] != 42 {
			t.Fatalf("result[%d] = %v; want {v:42}", i, r)
		}
	}
}

func TestCacheLoadJSONPropagatesLoaderError(t *testing.T) {
	t.Cleanup(func() { Redis = nil })
	Redis = nil

	want := errors.New("db boom")
	loader := func() (any, error) { return nil, want }
	var dest map[string]int
	err := CacheLoadJSON("stampede:err", time.Second, &dest, loader)
	if !errors.Is(err, want) {
		t.Fatalf("err = %v; want %v", err, want)
	}
}
