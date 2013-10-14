
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
	component build --use component-uglifyjs --standalone Reservations --out . --name reservations.min
	uglifyjs --output reservations.min.js reservations.min.js

template/%.js: template/%.html
	minstache < $< > $@

test: reservations.js
	open test/index.html

reservations.js: build
	component build --standalone Reservations --out . --name reservations

watch:
	watch $(MAKE) reservations.js

.PHONY: build clean install jshint test watch
