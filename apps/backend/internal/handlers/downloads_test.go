package handlers

import "testing"

func TestPlatformFor(t *testing.T) {
	cases := map[string]string{
		"Kairo-macOS.dmg":                 "macos",
		"EmployeeTracker-Windows-x64.msi": "windows",
		"Kairo-Windows-x64-setup.exe":     "windows",
		"Kairo_1.5.1_x64-setup.exe":       "", // updater-style artifact: not a fresh install
		"Kairo-extension.zip":             "extension",
		"other.zip":                       "",
		"latest.json":                     "",
	}
	for name, want := range cases {
		if got := platformFor(name); got != want {
			t.Errorf("platformFor(%q) = %q, want %q", name, got, want)
		}
	}
}
