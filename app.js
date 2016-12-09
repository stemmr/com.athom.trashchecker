/*globals Homey, module, require, setInterval*/
"use strict";

var http = require('http');
var apiArray = require('./trashapis.js');
var gdates = '';
var manualInput = false;

function init() {

	// Update manual input dates when settings change.
	Homey.manager('settings').on('set', onSettingsChanged);
	Homey.manager('flow').on('condition.days_to_collect', flowDaysToCollect);
	Homey.manager('speech-input').on('speech', parseSpeach);
	
	// Check if we have to handle manual input, or automatically.
	if(Homey.manager('settings').get('manualInput'))
	{
		var manually = Homey.manager('settings').get('manualInput');
		if(manually === true)
		{
			manualInput = true;
		}
		else
		{
			manualInput = false;
		}
	}

	// Manually kick off data retrieval
	onUpdateData();
	
	// Every 24 hours update API or manual dates
	setInterval(onUpdateData, 86400000); // Every 24-hours
}

module.exports.init = init;
module.exports.updateAPI = updateAPI;

/* ******************
	SPEECH FUNCTIONS
********************/
function parseSpeach (speech, callback) {
  Homey.log('parseSpeach()', speech);
  console.log(speech);
  speech.triggers.some(function (trigger) {
    switch (trigger.id) {
      case 'trash_collected' :
        
		console.log(speech);

        // Only execute 1 trigger
        return true
		
    }
  });

  callback(null, true);
}

/* ******************
	FLOW FUNCTIONS
********************/
function flowDaysToCollect(callback, args)
{
	// For testing use these variables, will become pulled from settings
	Homey.log(Object.keys(gdates));

	if( typeof gdates[ args.trash_type.toUpperCase() ] === 'undefined' )
	{
		return callback( new Error("Invalid address") );
	}

	var now = new Date();
	//uncomment below to test on working date(or some other number)
	//now.setDate(now.getDate() -1);
	if(args.when == 'tomorrow') {
		now.setDate(now.getDate() + 1);
	} else if(args.when == 'datomorrow') {
		now.setDate(now.getDate() + 2);
	}

	var dateString = dateToString(now);
	Homey.log(dateString);
	return callback( null, gdates[ args.trash_type.toUpperCase() ].indexOf(dateString) > -1 );
}

/* ******************
	EVENT HANDLERS
********************/
function onSettingsChanged(parameterName)
{
	if(parameterName !== "manualEntryData")
	{
		return;
	}
	
	GenerateNewDaysBasedOnManualInput();
	console.log("New manual dates generated");
	console.log(gdates);
}

function onUpdateData()
{
	if (manualInput === false && 
		Homey.manager('settings').get('postcode') &&
		Homey.manager('settings').get('hnumber') &&
		Homey.manager('settings').get('country')){

		updateAPI(
			Homey.manager('settings').get('postcode'),
			Homey.manager('settings').get('hnumber'),
			Homey.manager('settings').get('country'),
			function(success){
				if(success){
					Homey.log('retrieved house information');
				}else{
					Homey.log('house information has not been set');
				}
			}
		);
	}
	else if(manualInput === true)
	{
		// Generate new days based on manual input
		GenerateNewDaysBasedOnManualInput();
		console.log(gdates);
	}
}

/* ******************
	COMMON FUNCTIONS
********************/
function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function dateToString(inputDate)
{
	var dateString = pad( inputDate.getDate(), 2);
	dateString += '-';
	dateString += pad( inputDate.getMonth()+1, 2);
	dateString += '-';
	dateString += inputDate.getFullYear();
	return dateString;
}

function updateAPI(postcode, homenumber, country, callback) {
	//postcode = '5301hBD';
	//homenumber = '13';
	//country = 'NL';
	function asyncLoop(iterations, func, callback) {
		var index = 0;
		var done = false;
		var loop = {
			next: function() {
				if (done) {
					return;
				}

				if (index < iterations) {
					index++;
					func(loop);

				} else {
					done = true;
					callback();
				}
			},

			iteration: function() {
				return index - 1;
			},

			break: function() {
				done = true;
				callback();
			}
		};
		loop.next();
		return loop;
	}

	asyncLoop(apiArray.length, function(loop) {
		apiArray[loop.iteration()](postcode,homenumber,country,(err,result)=> {
			if(err) {
				console.log('error while looping');
				loop.next();
			} else if(Object.keys(result).length > 0) {
				gdates = result;
				callback(true);
			} else if(Object.keys(result).length === 0) {
				loop.next();
			}
		});
	},()=> {
		console.log('Checked all APIs');
		return callback(false);
	});
}

function GenerateNewDaysBasedOnManualInput()
{
	// Retrieve settings
	var manualSettings = Homey.manager('settings').get('manualEntryData');
	var dates = {};
	
	// Parse dates per type
	if(manualSettings.gft)
	{
		dates.GFT = CalculatePickupDates(manualSettings.gft);
	}
	
	if(manualSettings.paper)
	{
		dates.PAPIER = CalculatePickupDates(manualSettings.paper);
	}
	
	if(manualSettings.rest)
	{
		dates.REST = CalculatePickupDates(manualSettings.rest);
	}
	
	if(manualSettings.pmd)
	{
		dates.PMD = CalculatePickupDates(manualSettings.pmd);
	}
	
	if(manualSettings.plastic)
	{
		dates.PLASTIC = CalculatePickupDates(manualSettings.plastic);
	}
	
	if(manualSettings.textile)
	{
		dates.TEXTIEL = CalculatePickupDates(manualSettings.textile);
	}
	
	// Push to gdates
	gdates = dates;
}

function CalculatePickupDates(settings)
{
	var result = [];

	var interval = -1;
	try { 
		interval = parseInt(settings.option);
	} catch(e) { console.log(e); };
	
	var intervalExtended = -1;
	try { 
		intervalExtended = parseInt(settings.option_extension);
	} catch(e) { console.log(e); };
	
	var startDate = new Date(Date.now());
	try { 
		startDate = settings.startdate;
	} catch(e) { console.log(e); };
	
	var dayOfWeek = null;
	try { 
		dayOfWeek = parseInt(settings.day);
	} catch(e) { console.log(e); };
	
	var currentDate = new Date(Date.now());
	var startDate = new Date(startDate);
	
	var firstDayInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
	var previousMonth = new Date(new Date(firstDayInCurrentMonth).setMonth(firstDayInCurrentMonth.getMonth()-1));
	var nextMonth = new Date(new Date(firstDayInCurrentMonth).setMonth(firstDayInCurrentMonth.getMonth()+1));
	var afterNextMonth = new Date(new Date(firstDayInCurrentMonth).setMonth(firstDayInCurrentMonth.getMonth()+2));
	
	if(interval >= 5 && interval <= 7) // every x-th week of month/quarter/year
	{
		var nThWeek = interval-4;
		var date1 = new Date();
		var date2 = new Date();
		var date3 = new Date();
		
		if(intervalExtended == 12) // every x-th week of the year
		{
			date1 = nthDayInMonth(nThWeek, dayOfWeek, 0, currentDate.getFullYear()-1);
			date2 = nthDayInMonth(nThWeek, dayOfWeek, 0, currentDate.getFullYear());
			date3 = nthDayInMonth(nThWeek, dayOfWeek, 0, currentDate.getFullYear()+1);
		}
		else if(intervalExtended == 3) // every x-th week of the quarter
		{
			var currentQuarter = ((currentDate.getMonth()-((currentDate.getMonth()+3)%3))/3);
			var currentQuarterStart = new Date(currentDate.getFullYear(), currentQuarter*3, 1);
			var previousQuarterStart = new Date(new Date(currentQuarterStart).setMonth(currentQuarterStart.getMonth()-3));
			var nextQuarterStart = new Date(new Date(currentQuarterStart).setMonth(currentQuarterStart.getMonth()+3));
			
			date1 = nthDayInMonth(nThWeek, dayOfWeek, previousQuarterStart.getMonth(), previousQuarterStart.getFullYear());
			date2 = nthDayInMonth(nThWeek, dayOfWeek, currentQuarterStart.getMonth(), currentQuarterStart.getFullYear());
			date3 = nthDayInMonth(nThWeek, dayOfWeek, nextQuarterStart.getMonth(), nextQuarterStart.getFullYear());
		}
		else // every x-th week of the month
		{		
			date1 = nthDayInMonth(nThWeek, dayOfWeek, previousMonth.getMonth(), previousMonth.getFullYear());
			date2 = nthDayInMonth(nThWeek, dayOfWeek, firstDayInCurrentMonth.getMonth(), firstDayInCurrentMonth.getFullYear());
			date3 = nthDayInMonth(nThWeek, dayOfWeek, nextMonth.getMonth(), nextMonth.getFullYear());
		}
		
		result.push(dateToString(date1));
		result.push(dateToString(date2));
		result.push(dateToString(date3));
	}
	else if(interval <= 4) // per week
	{
		var date0 = everyNthWeek(interval, dayOfWeek, startDate, currentDate, -2);
		var date1 = everyNthWeek(interval, dayOfWeek, startDate, currentDate, -1);
		var date2 = everyNthWeek(interval, dayOfWeek, startDate, currentDate, 0);
		var date3 = everyNthWeek(interval, dayOfWeek, startDate, currentDate, 1);
		var date4 = everyNthWeek(interval, dayOfWeek, startDate, currentDate, 2);
		
		result.push(dateToString(date0));
		result.push(dateToString(date1));
		result.push(dateToString(date2));
		result.push(dateToString(date3));
		result.push(dateToString(date4));
	}
	else if(interval >= 8 && interval <= 9) // every last, every second last
	{
		var nthLastWeekOf = interval-7;
		
		var date1 = new Date();
		var date2 = new Date();
		var date3 = new Date();
		var date4 = new Date();
		
		if(intervalExtended == 12) // every x-th last week of the year
		{
			date1 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, 0, currentDate.getFullYear()-1);
			date2 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, 0, currentDate.getFullYear());
			date3 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, 0, currentDate.getFullYear()+1);
			date4 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, 0, currentDate.getFullYear()+2);
		}
		else if(intervalExtended == 3) // every x-th last week of the quarter
		{
			var currentQuarter = ((currentDate.getMonth()-((currentDate.getMonth()+3)%3))/3);
			var currentQuarterStart = new Date(currentDate.getFullYear(), currentQuarter*3, 1);
			var previousQuarterStart = new Date(new Date(currentQuarterStart).setMonth(currentQuarterStart.getMonth()-3));
			var nextQuarterStart = new Date(new Date(currentQuarterStart).setMonth(currentQuarterStart.getMonth()+3));
			var overNextQuarterStart = new Date(new Date(currentQuarterStart).setMonth(currentQuarterStart.getMonth()+6));
			
			date1 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, previousQuarterStart.getMonth(), previousQuarterStart.getFullYear());
			date2 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, currentQuarterStart.getMonth(), currentQuarterStart.getFullYear());
			date3 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, nextQuarterStart.getMonth(), nextQuarterStart.getFullYear());
			date4 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, overNextQuarterStart.getMonth(), overNextQuarterStart.getFullYear());
		}
		else // every x-th last week of the month
		{		
			date1 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, previousMonth.getMonth(), previousMonth.getFullYear());
			date2 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, firstDayInCurrentMonth.getMonth(), firstDayInCurrentMonth.getFullYear());
			date3 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, nextMonth.getMonth(), nextMonth.getFullYear());
			date4 = nthLastDayInMonth(nthLastWeekOf, dayOfWeek, afterNextMonth.getMonth(), afterNextMonth.getFullYear());
		}
		
		result.push(dateToString(date1));
		result.push(dateToString(date2));
		result.push(dateToString(date3));
		result.push(dateToString(date4));
	}
	
	return result;
}

function toDays(d) {
	d = d || 0;
	return d / 24 / 60 / 60 / 1000;
}

function daysInMonth(m, y) { 
	var y = y || new Date(Date.now()).getFullYear(); 
	return toDays(Date.UTC(y, m + 1, 1) - Date.UTC(y, m, 1)); 
}

function toUTC(d) { 
	if(!d || !d.getFullYear) return 0; 
	return Date.UTC(d.getFullYear(), d.getMonth(),d.getDate());
}

function daysBetween(d1,d2) { 
	return toDays(toUTC(d2)-toUTC(d1)); 
}

function firstDayInMonth(day, m, y) {
	return new Date(y, m, 1 + (day - new Date(y, m, 1).getDay() + 7) % 7);
}

function nthLastDayInMonth(n, day, m, y)
{
	var d = firstDayInMonth(day, m, y);
	return new Date(d.getFullYear(), d.getMonth(), (d.getDate() - (n * 7)));
}

function nthDayInMonth(n, day, m, y) { 	
	var d = firstDayInMonth(day, m, y);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (n - 1) * 7);
}

function everyNthWeek(n, d, givenDate, currentDate, delta)
{
	var correctWithDays = d - currentDate.getDay();
	givenDate = new Date(givenDate.getFullYear(), givenDate.getMonth(), (givenDate.getDate() + (d - givenDate.getDay())));
	currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), (currentDate.getDate() + (d - currentDate.getDay())));
	
	var difference = daysBetween(givenDate, currentDate);
	if(difference < 0) { difference = difference * -1; }
	
	var differenceWithCurrentDate = (difference % (n * 7)) + (delta * n * 7);
	
	return new Date(currentDate.getFullYear(), currentDate.getMonth(), (currentDate.getDate() + differenceWithCurrentDate));
}