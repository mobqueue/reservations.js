
/**
 * Dependencies
 */

var alertTemplate = require('./template/alert')
  , classes = require('classes')
  , confirmTemplate = require('./template/confirm')
  , debug = require('debug')('reservations.js')
  , domready = require('domready')
  , events = require('event')
  , form = require('./template/form')
  , Spinner = require('spinner')
  , success = require('./template/success')
  , superagent = require('superagent')
  , value = require('value');

/**
 * API Endpoints
 */

var PERFECT_API_KEY = null
  , PERFECT_API_URL = 'https://api.perfec.tt/restaurant/public'
  , PERFECT_API_VERSION = '1.4.0';

/**
 * Run
 */

module.exports.activate = function(key) {
  debug('activating with %s', key);

  // save the key
  PERFECT_API_KEY = key;
  
  // make sure the dom is loaded
  domready(function() {
    debug('authenticating');
    get('/auth', function(err) {
      if (err) {
        debug(err);
        window.alert('Unable to load Perfect form.\n' + err.message);
      } else {
        debug('authenticated');
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
  var $form = $perfect.getElementsByTagName('form')[0]
    , $date = document.getElementById('perfect-date')
    , $partySize = document.getElementById('perfect-party-size')
    , $phone = document.getElementById('perfect-phone');

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
  var $alerts = document.getElementById('perfect-alerts')
    , $create = document.getElementById('perfect-create')
    , $date = document.getElementById('perfect-date')
    , $form = document.getElementById('perfect-reservation-form')
    , $fieldset = $form.getElementsByTagName('fieldset')[0]
    , $name = document.getElementById('perfect-name')
    , $phone = document.getElementById('perfect-phone')
    , $time = document.getElementById('perfect-time');

  // clear alerts
  $alerts.innerHTML = null;
 
  var displayTime = $time.options[$time.selectedIndex].innerText
    , displayDate = value($date);
 
  var reservation = {
    name: value($name)
  , phone: parseInt(value($phone), 10)
  , partySize: getPartySize()
  , date: getDate()
  , time: parseInt(value($time), 10)
  };

  if (isValidData(reservation)) {
    // show confirmation screen
    $create.style.display = 'none';

    $fieldset.innerHTML += confirmTemplate({
      partySize: reservation.partySize
    , time: displayTime
    , date: displayDate
    , name: reservation.name
    });

    var $goBack = document.getElementById('perfect-go-back')
      , $confirmButton = document.getElementById('perfect-confirm-button');
    
    events.bind($goBack, 'click', function(e) {
      debug('going back to the form');
      e.preventDefault();
      document.getElementById('perfect-confirm').remove();
      document.getElementById('perfect-create').style.display = 'block';
      setTimeAndSubmitDisabled(true);
    });

    events.bind($confirmButton, 'click', function(e) {
      debug('confirming reservation for %s of %s at %s on %s', reservation.name, reservation.partySize, reservation.time, reservation.date);
      e.preventDefault();

      reservation.time = midnight(reservation.date).valueOf() + reservation.time * 1000 * 60;
      delete reservation.date;

      post('/reservations', reservation, function(err) {
        document.getElementById('perfect-confirm').remove();
        if (err) {
          document.getElementById('perfect-create').style.display = 'block';
          addAlert('form', 'There was a problem creating your reservation. If you have already created a reservation with this phone number you will not be able to create a second on the same day. Please refresh the page and try again.');
        } else {
          // show success screen
          $fieldset.innerHTML += success({
            partySize: reservation.partySize
          , time: displayTime
          , date: displayDate
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
  var date = getDate()
    , today = midnight(new Date());
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

  var $alerts = document.getElementById('perfect-alerts')
    , partySize = getPartySize()
    , date = getDate()
    , $time = document.getElementById('perfect-time');

  $alerts.innerHTML = null;

  if (isNaN(date.getTime()) || date.valueOf() < midnight(new Date()).valueOf() || partySize === 0) {
    setTimeAndSubmitDisabled(true);
  } else {
    get('/reservations/availableTimes/' + partySize + '/' + (date.getFullYear()) + '/' + (date.getMonth() + 1) + '/' + (date.getDate()), function(err, data) {
      if (!err) {
        $time.innerHTML = null;

        if (data.length && data.length > 0) {
          for (var i = 0; i < data.length; i++) {
            var time = data[i]
              , h = time > 720 ? time / 60 - 12 : time / 60 
              , m = time % 60 === 0 ? '00' : '' + (time % 60)
              , a = time > 720 ? ' pm' : ' am'
              , format = parseInt(h, 10) + ':' + m + a
              , option = document.createElement('option');
            
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
  get('/reservations/partySizes', function(err, partySizes) {
    if (!err) {
      var $partySize = document.getElementById('perfect-party-size');
      for (var i = 0; i < partySizes.length; i++) {
        var option = document.createElement('option')
          , size = partySizes[i];

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

  var name = data.name
    , phone = data.phone
    , date = data.date
    , partySize = data.partySize
    , time = data.time
    , valid = true;

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
 * Add an alert
 */

function addAlert(field, message) {
  var $alerts = document.getElementById('perfect-alerts');

  $alerts.innerHTML += alertTemplate({
    field: field
  , message: message
  });

  var $button = $alerts.getElementsByTagName('button')[0]
    , $field = document.getElementById('perfect-' + field);

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
  var $time = document.getElementById('perfect-time')
    , $submit = document.getElementById('perfect-submit');

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
 * Get the given date
 */

function getDate() {
  var $date = document.getElementById('perfect-date')
    , date = new Date(value($date));
  date.setDate(date.getDate() + 1);
  
  if (isNaN(date.valueOf())) {
    var text = value($date).split('-');
    date = new Date(text[0], text[1] - 1, text[2]);
  }

  return date;
}

/**
 * Numeric input only
 */

function numericInputOnly(e) {
  var key = e.charCode || e.keyCode || 0;
  if (key === 8 || key === 46 || (key >= 37 && key <= 40) || (key >= 48 && key <= 57 && !e.shiftKey) || (key >= 96 && key <= 105 && !e.shiftKey)) {
    return;
  } else {
    e.preventDefault();
  }
}

/**
 * Spin
 */

function spin() {
  var spinner = new Spinner()
    , $perfectSpinner = document.getElementById('perfect-spinner');
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

function get(url, callback) {
  var spinner = spin();
  superagent
  .get(PERFECT_API_URL + url)
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
