package filestore

import (
	"errors"
	"image"
	_ "image/jpeg" // decoders: the desktop uploads WebP, but accept any common format
	"image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// ThumbWidth is the max width of gallery thumbnails (2x a ~240px grid cell).
const ThumbWidth = 480

// thumbRel is the cached thumbnail's path next to the original:
// <client_uuid>.webp → <client_uuid>.thumb.jpg
func thumbRel(rel string) string {
	return strings.TrimSuffix(rel, filepath.Ext(rel)) + ".thumb.jpg"
}

// OpenThumb opens a small JPEG thumbnail of a stored screenshot, generating and
// caching it on first use. Generated files are written atomically, so concurrent
// first requests at worst both render it.
func (s *Store) OpenThumb(rel string) (*os.File, error) {
	tAbs, err := s.abs(thumbRel(rel))
	if err != nil {
		return nil, err
	}
	if f, err := os.Open(tAbs); err == nil {
		return f, nil
	}

	src, err := s.Open(rel)
	if err != nil {
		return nil, err
	}
	img, _, err := image.Decode(src)
	src.Close()
	if err != nil {
		return nil, err
	}

	b := img.Bounds()
	if b.Dx() <= 0 || b.Dy() <= 0 {
		return nil, errors.New("empty image")
	}
	w, h := b.Dx(), b.Dy()
	if w > ThumbWidth {
		h = h * ThumbWidth / w
		w = ThumbWidth
	}
	if h < 1 {
		h = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), img, b, draw.Src, nil)

	tmp, err := os.CreateTemp(filepath.Dir(tAbs), ".thumb-*")
	if err != nil {
		return nil, err
	}
	if err := jpeg.Encode(tmp, dst, &jpeg.Options{Quality: 75}); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return nil, err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmp.Name())
		return nil, err
	}
	if err := os.Rename(tmp.Name(), tAbs); err != nil {
		os.Remove(tmp.Name())
		return nil, err
	}
	return os.Open(tAbs)
}
