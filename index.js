
/**
 * Dependencies
 */

var $ = require('jquery')
  , confirm = require('./confirm')
  , form = require('./form')
  , success = require('./success');

/**
 * API Endpoints
 */

var PERFECT_API_URL = 'http://localhost:5000/restaurant/public'
  , PERFECT_API_VERSION = '1.4.0';

/**
 *  Once jQuery is rearing, check if this domain is authed, then show the form
 */

$(function() {
  get('/auth', function(err, xhr) {
    if (!err) {
      showReservationForm();
    } else {
      alert('Unable to load Perfect form.');
    }
  });
});

/**
 * Show reservation form
 */

function showReservationForm() {
  $('#perfect-res-form').html(template);
  $('#perfect-res-date input').val((new Date()).toISOString().substring(0, 10));
  $('#perfect-res-form form').submit(handleFormSubmission);
  $('#perfect-res-date input').change(handleDateChange);
  $('#perfect-res-party-size select').change(retrieveAvailableTimes);

  // Accept numeric input only
  $('#perfect-res-phone input').keydown(function(e) {
    var key = e.charCode || e.keyCode || 0;
    return key === 8 || key === 46 || (key >= 37 && key <= 40) || (key >= 48 && key <= 57 && !e.shiftKey) || (key >= 96 && key <= 105 && !e.shiftKey);
  });

  get('/reservations/partySizes', function(err, xhr, partySizes) {
    if (!err) {
      var partySizeDropdown = document.querySelector('#perfect-res-party-size select');

      for (var i = 0; i < partySizes.length, i++) {
        var option = document.createElement('option')
          , size = partySizes[i];

        option.innerText = size;
        option.value = size;

        partySizeDropdown.appendChild(option);
      }
    }
  });
}

/**
 * Handle form submission
 */

function handleFormSubmission(event) {
  event.preventDefault();
  $('#perfect-res-form-alert').empty();
 
  var displayTime = $('#perfect-res-time select option:selected').html()
    , displayDate = $('#perfect-res-date input').val();
 
  var reservation = {
    name: $('#perfect-res-name input').val()
  , phone: parseInt($('#perfect-res-phone input').val(), 10)
  , partySize: getPartySize()
  , date: getDate()
  , time: parseInt($('#perfect-res-time select').val(), 10)
  };

  if (isValidData(reservation)) {
    var confirm = $('#perfect-res-confirm');
    
    confirm.find('.party-size').html(reservation.partySize);
    confirm.find('.time').html(displayTime);
    confirm.find('.date').html(displayDate);
    confirm.find('.name').html(reservation.name);
    
    confirm.find('#perfect-res-go-back').click(function(e) {
      e.preventDefault();
      $('#perfect-res-form form').css('display', 'block');
      $('#perfect-res-confirm').css('display', 'none');
    });

    confirm.find('#perfect-res-confirm-button').click(function(e) {
      e.preventDefault();
      reservation.time = midnight(reservation.date).valueOf() + reservation.time * 1000 * 60;
      delete reservation.date;

      post('/reservations', reservation, function(err, xhr, data) {
        if (err) {
          $('#perfect-res-form form').css('display', 'block');
          $('#perfect-res-confirm').css('display', 'none');
          addAlert('form', 'There was a problem creating your reservation. If you have already created a reservation with this phone number you will not be able to create a second on the same day. Please refresh the page and try again.');
        } else {
          var success = $('#perfect-res-success');
          success.find('.party-size').html(reservation.partySize);
          success.find('.time').html(displayTime);
          success.find('.date').html(displayDate);
          $('#perfect-res-confirm').css('display', 'none');
          success.css('display', 'block');
        }
      });
    });
    $('#perfect-res-form form').css('display', 'none');
    confirm.css('display', 'block');
  }
  return false;
}

/**
 * Handle date change
 */

function handleDateChange(event) {
  var date = getDate()
    , today = midnight(new Date());
  if (date.valueOf() < today.valueOf()) {
    $(this).val(today.toISOString().substring(0, 10));
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
  var partySize = getPartySize()
    , date = getDate();

  $('#perfect-res-form-alert').empty();

  if (isNaN(date.getTime()) || date.valueOf() < midnight(new Date()).valueOf() || partySize === 0) {
    setTimeAndSubmitDisabled();
  } else {
    get('/reservations/availableTimes/' + partySize + '/' + (date.getFullYear()) + '/' + (date.getMonth() + 1) + '/' + (date.getDate()), function(err, xhr, data) {
      if (!err) {
        var timeDropDown = $('#perfect-res-time select');
        timeDropDown.empty();

        if (data.length && data.length > 0) {
          $.each(data, function(index, time) {
            var h = time > 720 ? time / 60 - 12 : time / 60 
              , m = time % 60 === 0 ? '00' : '' + (time % 60)
              , a = time > 720 ? ' pm' : ' am'
              , format = parseInt(h, 10) + ':' + m + a
              , option = document.createElement('option');
            
            option = $(option).html(format).val(time);
            timeDropDown.append(option);
          });
          setTimeAndSubmitDisabled(false);
        } else {
          addAlert('date', 'No reservations available for parties of ' + partySize + ' on ' + date);
        }
      }
    });
  }
}

/**
 * Check if the data is valid
 */

function isValidData(data) {
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
 * Wrapper for get
 */

function get(url, callback, context) {
  $.ajax({
    url: PERFECT_API_URL + url
  , type: 'GET'
  , headers: {
      'X-Perfect-API-Key': PERFECT_API_KEY
    , 'X-Perfect-API-Version': PERFECT_API_VERSION
    }
  , success: function(data, text, xhr) {
      callback(null, xhr, data);
    }
  , error: function(xhr, text, error) {
      callback(xhr.status, xhr);
    }
  });
}

/**
 * Wrapper for post
 */

function post(url, data, callback, context) {
  $.ajax({
    url: PERFECT_API_URL + url
  , type: 'POST'
  , headers: {
      'X-Perfect-API-Key': PERFECT_API_KEY
    , 'X-Perfect-API-Version': PERFECT_API_VERSION
    }
  , data: data
  , success: function(data, text, xhr) {
      callback(null, xhr, data);
    }
  , error: function(xhr, text, error) {
      callback(xhr.status, xhr);
    }
  });
}

/**
 * Add an alert
 */

function addAlert(field, message) {
  $('#perfect-res-form-alert').append('<div class="perfect-res-alert perfect-res-' + field + '-alert"><button class="perfect-res-alert-close" data-dismiss="perfect-res-' + field + '-alert">x</button>' + message + '</div>');
  $('#perfect-res-form-alert .perfect-res-' + field + '-alert button').click(function() {
    var alert = $(this).attr('data-dismiss');
    $('.' + alert).remove();
  });
  $('#perfect-res-' + field).addClass('perfect-res-error');
  $('#perfect-res-' + field + ':input').change(function() {
    $(this).removeClass('perfect-res-error');
  });
}

/**
 * Enable/Disable time and submit
 */

function setTimeAndSubmitDisabled(disabled) {
  if (disabled == null) {
    disabled = true;
  }

  $('#perfect-res-time select').attr('disabled', disabled);
  $('#perfect-res-buttons input').attr('disabled', disabled);
}

/**
 * Get the current party size
 */

function getPartySize() {
  return parseInt($('#perfect-res-party-size select').val(), 10);
}

/**
 * Get the given date
 */

function getDate() {
  var date = new Date($('#perfect-res-date input').val());
  date.setDate(date.getDate() + 1);
  if (isNaN(date.valueOf())) {
    var text = $('#perfect-res-date input').val().split('-');
    date = new Date(text[0], text[1] - 1, text[2]);
  }
  return date;
}
