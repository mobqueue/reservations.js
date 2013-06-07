
build: jshint components index.js template/alert.js template/confirm.js template/form.js template/success.js
	component build --dev --verbose

clean:
	rm -fr build components template/alert.js template/confirm.js template/form.js template/success.js

components: component.json
	component install --dev

install:
	npm install --global component jshint uglify-js
	$(MAKE) release

jshint: index.js
	jshint --verbose index.js

reservations.min.js: reservations.js
	uglifyjs --output reservations.min.js reservations.js

template/%.js: template/%.html
	minstache < $< > $@

reservations.js: build
	component build --standalone Reservations --out . --name Reservations

watch:
	watch $(MAKE) reservations.js

.PHONY: build clean install jshint watch
