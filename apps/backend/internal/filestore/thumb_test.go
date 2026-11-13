package filestore

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
)

func TestOpenThumbScalesCachesAndRemoves(t *testing.T) {
	s := New(t.TempDir())

	src := image.NewRGBA(image.Rect(0, 0, 1920, 1080))
	for x := 0; x < 1920; x++ {
		src.Set(x, 500, color.RGBA{255, 0, 0, 255})
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, src); err != nil {
		t.Fatal(err)
	}
	rel, err := s.Write(uuid.NewString(), uuid.NewString(), 1_700_000_000, uuid.NewString(), buf.Bytes())
	if err != nil {
		t.Fatalf("write: %v", err)
	}

	f, err := s.OpenThumb(rel)
	if err != nil {
		t.Fatalf("open thumb: %v", err)
	}
	cfg, err := jpeg.DecodeConfig(f)
	f.Close()
	if err != nil {
		t.Fatalf("thumb is not a jpeg: %v", err)
	}
	if cfg.Width != ThumbWidth || cfg.Height != 1080*ThumbWidth/1920 {
		t.Fatalf("thumb size = %dx%d", cfg.Width, cfg.Height)
	}

	thumbAbs := filepath.Join(s.root, thumbRel(rel))
	if _, err := os.Stat(thumbAbs); err != nil {
		t.Fatalf("thumb not cached: %v", err)
	}
	if err := s.Remove(rel); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if _, err := os.Stat(thumbAbs); !os.IsNotExist(err) {
		t.Fatalf("thumb not removed with original: %v", err)
	}
}

func TestRemoveRejectsEscape(t *testing.T) {
	s := New(t.TempDir())
	if err := s.Remove("../../etc/passwd"); err != nil {
		// Cleaned to <root>/etc/passwd (missing) → nil; must never touch outside root.
		t.Fatalf("remove: %v", err)
	}
}
