
/**
 * Dependencies
 */

var alertTemplate = require('./template/alert');
var classes = require('classes');
var confirmTemplate = require('./template/confirm');
var debug = require('debug')('reservations.js');
var domready = require('domready');
var events = require('event');
var form = require('./template/form');
var Spinner = require('spinner');
var success = require('./template/success');
var superagent = require('superagent');
var value = require('value');

/**
 * API Endpoints
 */

var PERFECT_API_KEY = null;
var PERFECT_API_URL = 'https://api.perfec.tt/v1/restaurants';
var PERFECT_API_VERSION = '1.5.0';

/**
 * Run
 */

module.exports.activate = function(key, url) {
  // save the key
  PERFECT_API_KEY = key;

  // if a url is passed, set the url
  if (url) {
    PERFECT_API_URL = url;
  }

  debug('key %s', PERFECT_API_KEY);
  debug('url %s', PERFECT_API_URL);
  debug('version %s', PERFECT_API_VERSION);

  // make sure the dom is loaded
  domready(function () {
    debug('authenticating');
    get('/auth', function (err, restaurant) {
      if (err) {
        debug(err);
        window.alert('Unable to load Perfect reservation form.\n' + err.message);
      } else {
        debug('authenticated');
        PERFECT_API_URL += '/' + restaurant._id;
        setup();
      }
    });
  });
};

/**
 * Show reservation form
 */

function setup() {
  debug('showing reservation form');

  // append the form
  var $perfect = document.getElementById('perfect-reservation-form');
  $perfect.innerHTML = form();

  // inputs
  var $form = $perfect.getElementsByTagName('form')[0];
  var $date = document.getElementById('perfect-date');
  var $partySize = document.getElementById('perfect-party-size');
  var $phone = document.getElementById('perfect-phone');

  // set the default date
  value($date, (new Date()).toISOString().substring(0, 10));

  // event handlers
  events.bind($form, 'submit', handleFormSubmission);
  events.bind($date, 'change', handleDateChange);
  events.bind($partySize, 'change', retrieveAvailableTimes);
  events.bind($phone, 'keydown', numericInputOnly);

  getAvailablePartySizes();
}

/**
 * Handle form submission
 */

function handleFormSubmission(event) {
  event.preventDefault();
  debug('handling form submission');

  // get elements
  var $alerts = document.getElementById('perfect-alerts');
  var $create = document.getElementById('perfect-create');
  var $date = document.getElementById('perfect-date');
  var $email = document.getElementById('perfect-email');
  var $form = document.getElementById('perfect-reservation-form');
  var $fieldset = $form.getElementsByTagName('fieldset')[0];
  var $name = document.getElementById('perfect-name');
  var $phone = document.getElementById('perfect-phone');
  var $time = document.getElementById('perfect-time');

  // clear alerts
  $alerts.innerHTML = null;

  var displayTime = $time.options[$time.selectedIndex].innerText;
  var displayDate = value($date);

  var reservation = {
    date: value($date),
    email: value($email),
    name: value($name),
    party: getPartySize(),
    phone: parseInt(value($phone), 10),
    time: value($time)
  };

  if (isValidData(reservation)) {
    // show confirmation screen
    $create.style.display = 'none';

    $fieldset.innerHTML += confirmTemplate({
      partySize: reservation.party,
      time: displayTime,
      date: displayDate,
      name: reservation.name
    });

    var $goBack = document.getElementById('perfect-go-back');
    var $confirmButton = document.getElementById('perfect-confirm-button');

    events.bind($goBack, 'click', function(e) {
      debug('going back to the form');
      e.preventDefault();
      document.getElementById('perfect-confirm').remove();
      document.getElementById('perfect-create').style.display = 'block';
      setTimeAndSubmitDisabled(true);
    });

    events.bind($confirmButton, 'click', function(e) {
      debug('confirming reservation for %s of %s at %s on %s', reservation.name, reservation.party, reservation.time, reservation.date);
      e.preventDefault();

      post('/reservations', reservation, function(err) {
        document.getElementById('perfect-confirm').remove();
        if (err) {
          document.getElementById('perfect-create').style.display = 'block';
          addAlert('reservation-form', 'There was a problem creating your reservation. If you have already created a reservation with this phone number you will not be able to create a second on the same day. Please refresh the page and try again.');
        } else {
          // show success screen
          $fieldset.innerHTML += success({
            partySize: reservation.party,
            time: displayTime,
            date: displayDate
          });
        }
      });
    });
  }

  return false;
}

/**
 * Handle date change
 */

function handleDateChange(event) {
  debug('handling date change');

  var date = getDate();
  var today = midnight(new Date());

  if (date.valueOf() < today.valueOf()) {
    value(event.target, today.toISOString().substring(0, 10));
  } else if (today.getMonth() < date.getMonth() && today.getDate() < date.getDate()) {
    addAlert('date', 'Reservation date must be within 30 days.');
  } else {
    retrieveAvailableTimes();
  }
}

/**
 * Retrieve available times for party size and date
 */

function retrieveAvailableTimes() {
  debug('retrieving available times');

  var $alerts = document.getElementById('perfect-alerts');
  var partySize = getPartySize();
  var date = value(document.getElementById('perfect-date'));
  var $time = document.getElementById('perfect-time');

  $alerts.innerHTML = null;

  if (partySize === 0) {
    setTimeAndSubmitDisabled(true);
  } else {
    get('/available-times', {
      party: partySize,
      date: date
    }, function (err, data) {
      if (err) {
        addAlert('date', err.message);
      } else {
        $time.innerHTML = null;

        if (data.length && data.length > 0) {
          for (var i = 0; i < data.length; i++) {
            var time = data[i];
            var h = parseInt(time.split(':')[0], 10);
            var a = h > 12 ? ' pm' : ' am';
            var format = (h > 12 ? h - 12 : h) + ':' + time.split(':')[1] + a;

            var option = document.createElement('option');

            option.innerHTML = format;
            option.value = time;

            $time.appendChild(option);
          }

          setTimeAndSubmitDisabled(false);
        } else {
          addAlert('date', 'No reservations available for parties of ' + partySize + ' on ' + date);
        }
      }
    });
  }
}

/**
 * Get available party sizes
 */

function getAvailablePartySizes() {
  debug('get available party sizes');
  get('/party-sizes', function (err, partySizes) {
    if (!err) {
      var $partySize = document.getElementById('perfect-party-size');
      for (var i = 0; i < partySizes.length; i++) {
        var option = document.createElement('option');
        var size = partySizes[i];

        option.innerText = size;
        option.value = size;

        $partySize.appendChild(option);
      }
    }
  });
}

/**
 * Check if the data is valid
 */

function isValidData(data) {
  debug('validating data');

  var name = data.name;
  var phone = data.phone;
  var date = getDate();
  var partySize = data.party;
  var time = data.time;
  var valid = true;

  if (!time || time === 0) {
    addAlert('time', 'Time selected is invalid.');
    valid = false;
  }

  if (isNaN(date)) {
    addAlert('date', 'Date is an invalid format.');
    valid = false;
  }

  if (!date) {
    addAlert('date', 'You must select a date.');
    valid = false;
  }

  if (date.valueOf() < midnight(new Date()).valueOf()) {
    addAlert('date', 'Date selected is in the past.');
    valid = false;
  }

  if (!name || name.length < 1 || name.length > 50) {
    addAlert('name', 'Name must be between 1 and 50 characters.');
    valid = false;
  }

  if (!phone || isNaN(phone) || phone < 1000000000 || phone > 9999999999) {
    addAlert('phone', 'Phone number must be in the format ########## and 10 digits.');
    valid = false;
  }

  if (!partySize || isNaN(partySize) || partySize < 1 || partySize > 99) {
    addAlert('partySize', 'Party Size must be between 1 and 99 people.');
    valid = false;
  }

  return valid;
}

/**
 * Get midnight of the given date
 */

function midnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Get the date
 */

function getDate() {
  var $date = document.getElementById('perfect-date');
  var vals = value($date).split('-');
  return new Date(vals[0], vals[1] - 1, vals[2]);
}

/**
 * Add an alert
 */

function addAlert(field, message) {
  var $alerts = document.getElementById('perfect-alerts');

  $alerts.innerHTML += alertTemplate({
    field: field,
    message: message
  });

  var $button = $alerts.getElementsByTagName('button')[0];
  var $field = document.getElementById('perfect-' + field);

  classes($field).add('perfect-error');

  events.bind($button, 'click', function(e) {
    var dismiss = e.target.attributes['data-dismiss'];
    $alerts.getElementsByClassName(dismiss)[0].remove();
  });

  events.bind($field, 'change', function(e) {
    classes($field).remove('perfect-error');
  });
}

/**
 * Enable/Disable time and submit
 */

function setTimeAndSubmitDisabled(disabled) {
  debug('setting time and submit disabled (%s)', disabled);
  var $time = document.getElementById('perfect-time');
  var $submit = document.getElementById('perfect-submit');

  if (disabled) {
    $time.setAttribute('disabled');
    $submit.setAttribute('disabled');
  } else {
    $time.removeAttribute('disabled');
    $submit.removeAttribute('disabled');
  }
}

/**
 * Get the current party size
 */

function getPartySize() {
  var $partySize = document.getElementById('perfect-party-size');
  return parseInt(value($partySize), 10);
}

/**
 * Numeric input only
 */

function numericInputOnly(e) {
  var key = e.charCode || e.keyCode || 0;
  if (key === 8 || key === 9 || key === 46 || (key >= 37 && key <= 40) || (key >= 48 && key <= 57 && !e.shiftKey) || (key >= 96 && key <= 105 && !e.shiftKey)) {
    return;
  } else {
    e.preventDefault();
  }
}

/**
 * Spin
 */

function spin() {
  var spinner = new Spinner();
  var $perfectSpinner = document.getElementById('perfect-spinner');

  if ($perfectSpinner) {
    $perfectSpinner.appendChild(spinner.el);
  }

  return {
    stop: function() {
      spinner.stop();
      if ($perfectSpinner) {
        $perfectSpinner.innerText = null;
      }
    }
  };
}

/**
 * Wrapper for get
 */

function get(url, query, callback) {
  if (arguments.length === 2) {
    callback = query;
    query = {};
  }

  var spinner = spin();
  superagent
  .get(PERFECT_API_URL + url)
  .query(query)
  .set({
    'X-Perfect-API-Key': PERFECT_API_KEY
  , 'X-Perfect-API-Version': PERFECT_API_VERSION
  })
  .end(function(err, res) {
    spinner.stop();
    if (err) {
      callback(err, res);
    } else if (res.error) {
      callback(res.error, res);
    } else {
      callback(null, res.body);
    }
  });
}

/**
 * Wrapper for post
 */

function post(url, data, callback) {
  var spinner = spin();
  superagent
  .post(PERFECT_API_URL + url)
  .send(data)
  .set({
    'X-Perfect-API-Key': PERFECT_API_KEY
  , 'X-Perfect-API-Version': PERFECT_API_VERSION
  })
  .end(function(err, res) {
    spinner.stop();
    if (err) {
      callback(err, res);
    } else if (res.error) {
      callback(res.error, res);
    } else {
      callback(null, res.body);
    }
  });
}
