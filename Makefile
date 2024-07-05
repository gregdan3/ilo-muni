BUILDDIR=dist
DEVNAME=lipu_mute

init:
	pnpm install

build:
	npx webpack --mode=development

dev:
	screen -S $(DEVNAME) -d -m npx http-server $(BUILDDIR)/

stopdev:
	screen -S $(DEVNAME) -X quit | true
