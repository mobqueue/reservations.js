
build: jshint components index.js confirm.js form.js success.js
	@component build --dev --verbose

%.js: %.html
	@component convert $<

components: component.json
	@component install --dev

clean:
	@rm -fr build components confirm.js form.js success.js

jshint: index.js
	@jshint --verbose index.js

min: reservations.js
	@uglifyjs --output reservations.min.js reservations.js

release: clean build reservations.js min

reservations.js: build
	@component build --standalone reservations --out . --name reservations

.PHONY: clean
