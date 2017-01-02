/*globals Homey, module, require, setInterval*/
"use strict";

var http = require('http');
var apiArray = require('./trashapis.js');
var gdates = '';
var manualInput = false;
var supportedTypes = ["GFT","PLASTIC","PAPIER","PMD","REST","TEXTIEL"];

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
function parseSpeach(speech, callback) {
  //Homey.log('parseSpeach()', speech);
  //console.log(speech);
  speech.triggers.some(function (trigger) {
    switch (trigger.id) {
      case 'trash_collected' :
        
		// TYPE OF QUESTIONS
		// WHAT type of trash is collected << TODAY | TOMORROW | DAY AFTER TOMORROW >>
		// WHEN is <<TYPE>> collected?
		// IS <<TYPE>> colllected << TODAY | TOMORROW | DAY AFTER TOMORROW >>
		// WHICH type will be collected << TODAY | TOMORROW | DAY AFTER TOMORROW >>
		
		var regexReplace = new RegExp("(" +__('speech.replacequestion')+ ")", 'gi');
		var newTranscript = speech.transcript.replace(regexReplace, "");
		
		/* ******************
			FIND TRASH TYPE INDICATOR
		********************/
		var foundType = null;
		var differenceInDaysForType = null;
		for (var i = 0, len = supportedTypes.length; i < len; i++) {
			if (newTranscript.indexOf(__('speech.type.' + supportedTypes[i])) > -1)
			{
				foundType = supportedTypes[i];
				break; // stop loop after first match.
			}
			
			// Other words for types (search via regex)
			var regex = new RegExp("(" +__('speech.type_multipleother.' + supportedTypes[i])+ ")", 'gi');
			if (newTranscript.match(regex) !== null)
			{
				foundType = supportedTypes[i];
				break; // stop loop after first match.
			}
		}
			
		// Find first collection date for this type of trash
		if(foundType != null && typeof gdates[ foundType ] !== 'undefined')
		{
			var today = new Date();
			for (var i = 0, len = gdates[foundType].length; i < len; i++)
			{				
				var date = new Date(gdates[foundType][i].substring(6,10), (parseInt(gdates[foundType][i].substring(3,5))-1), gdates[foundType][i].substring(0,2));
								
				if(daysBetween(today, date) >= 0)
				{
					differenceInDaysForType = daysBetween(today, date);
					break;
				}				
			}
		}
		
		//console.log("type and difference in days");
		//console.log(foundType);
		//console.log(differenceInDaysForType);
		
		/* ******************
			FIND TIME INDICATOR
		********************/
		var checkDate = null;
		var typeCollectedOnThisDay = [];
		var matchesWithGivenType = false;
		// If bigger then one, someone probably asked something like 'is the container picked up tomorrow or the day after tomorrow'
		if(speech.time != null && speech.time !== false && speech.time.length == 1) 
		{
			var dateInput = null;
			try {
				dateInput = new Date(speech.time[0].time.year, speech.time[0].time.month, speech.time[0].time.day);
			} catch(e) { console.log(e); }
			
			//console.log("given date via speech");
			//console.log(dateInput);
			checkDate = dateInput;
		}
		
		if(checkDate != null)
		{
			// Go through types
			for (var i = 0, len = supportedTypes.length; i < len; i++) {
				if( typeof gdates[ supportedTypes[i] ] !== 'undefined' )
				{
					if(gdates[ supportedTypes[i] ].indexOf(dateToString(checkDate)) > -1 && typeCollectedOnThisDay.indexOf(__('speech.type.' + supportedTypes[i])) <= -1)
					{
						typeCollectedOnThisDay.push(__('speech.output.type.' + supportedTypes[i]));
						if(!matchesWithGivenType)
						{
							matchesWithGivenType = supportedTypes[i] == foundType;
						}
					}
				}
			}
			
			//console.log("types collected on this day");
			//console.log(typeCollectedOnThisDay);
		}
		
		/* ******************
			FIND TYPE OF QUESTION (sentence starting with WHAT, IS, WHEN)
		********************/
		var questionType = 0;
		if(newTranscript.toLowerCase().startsWith(__('speech.questiontype.what')) || 
			newTranscript.toLowerCase().startsWith(__('speech.questiontype.which')))
		{
			questionType = 1;
		}
		else if(newTranscript.toLowerCase().startsWith(__('speech.questiontype.when')))
		{
			questionType = 2;
		}
		else if(newTranscript.toLowerCase().startsWith(__('speech.questiontype.is')))
		{
			questionType = 3;
		}
		
		//console.log("defined question type");
		//console.log(questionType);

		var responseText = "";
		try {
			// which, what type of trash is collected <<time>>
			if(questionType == 1 && checkDate != null)
			{
				if(typeCollectedOnThisDay.length == 0)
				{
					responseText = __('speech.output.notrashcollectedonx', { time: speech.time[0].transcript });
				}
				else if(typeCollectedOnThisDay.length > 1)
				{
					var multiTypeString = "";				
					for (var i = 0, len = multiTypeString.length; i < len; i++) {
						multiTypeString += typeCollectedOnThisDay[i] + (i < (len-2) ? ", " : (i == (len-2) ? " " + __('speech.output.and') + " " : ""));
					}
					
					responseText = __('speech.output.trashtypesycollectedonx', { time: speech.time[0].transcript, types: multiTypeString });
				}
				else
				{
					responseText = __('speech.output.trashtypeycollectedonx', { time: speech.time[0].transcript, type: typeCollectedOnThisDay[0] });
				}
			}
			// when is <<type>> collected?
			else if(questionType == 2 && foundType != null)
			{
				if(differenceInDaysForType === null)
				{
					responseText = __('speech.output.notrashcollectionforx', { type: __('speech.output.type.' + foundType) });
				}
				else
				{
					responseText = __('speech.output.trashtypexcollectedony', { type: __('speech.output.type.' + foundType), time: toDateOutputString(differenceInDaysForType) });
				}
			}
			// is <<type>> collected on <<date>>
			else if(questionType == 3 && foundType != null && checkDate != null)
			{
				if(differenceInDaysForType === null)
				{
					responseText = __('speech.output.notrashcollectionforx', { type: __('speech.output.type.' + foundType) });
				}
				else if(matchesWithGivenType)
				{
					responseText = __('speech.output.yesyiscollectedonx', { time: speech.time[0].transcript, type: __('speech.output.type.' + foundType) });
				}
				else 
				{
					responseText = __('speech.output.noyiscollectedonxbutonz', { time: speech.time[0].transcript, type: __('speech.output.type.' + foundType), time2: toDateOutputString(differenceInDaysForType) });
				}
			}
			else if(questionType == 1) // what|which type is collected next?
			{
				// Find the container that is picked up next
				var nextContainerNotBefore = new Date();
				var containerDateNext = new Date();
				containerDateNext.setDate(containerDateNext.getDate() + 366);
				var containerTypesNext = [];
				
				for (var i = 0, len = supportedTypes.length; i < len; i++) {
					if( typeof gdates[ supportedTypes[i] ] !== 'undefined' )
					{						
						for (var y = 0, len = gdates[supportedTypes[i]].length; y < len; y++)
						{				
							var date = new Date(gdates[supportedTypes[i]][y].substring(6,10), (parseInt(gdates[supportedTypes[i]][y].substring(3,5))-1), gdates[supportedTypes[i]][y].substring(0,2));
							
							if(daysBetween(nextContainerNotBefore, date) >= 0 && daysBetween(containerDateNext, date) <= 0)
							{
								var diff = daysBetween(containerDateNext, date);
								if(diff === 0)
								{
									containerTypesNext.push(__('speech.output.type.' + supportedTypes[i]));
								}
								else
								{
									containerDateNext = date;
									containerTypesNext = [];
									containerTypesNext.push(__('speech.output.type.' + supportedTypes[i]));
								}
							}			
						}
					}
				}
				
				//console.log(containerTypesNext);
				var differenceInDaysForNextCollection = daysBetween(nextContainerNotBefore, containerDateNext);
				
				if(containerTypesNext.length == 0)
				{
					responseText = __('speech.output.noknowntrashcollected');
				}
				else if(containerTypesNext.length > 1)
				{
					var multiTypeString = "";				
					for (var i = 0, len = multiTypeString.length; i < len; i++) {
						multiTypeString += containerTypesNext[i] + (i < (len-2) ? ", " : (i == (len-2) ? " " + __('speech.output.and') + " " : ""));
					}
					
					responseText = __('speech.output.trashtypesycollectedonx', { time: toDateOutputString(differenceInDaysForNextCollection), types: multiTypeString });
				}
				else
				{
					responseText = __('speech.output.trashtypeycollectedonx', { time: toDateOutputString(differenceInDaysForNextCollection), type: containerTypesNext[0] });
				}				
			}
		}
		catch(e)
		{
			console.log(e);
		}
		
		console.log(responseText);
		if(responseText != "")
		{
			speech.say(responseText, function callback(err, success) {
				// Do nothing, fired when Homey is done speaking.
			});
			
			callback(null, true);
			return true;
		}
		

        // Only execute 1 trigger
		callback(null, false);
        return false;
    }
  });

  callback(null, false);
}

/* ******************
	FLOW FUNCTIONS
********************/
function flowDaysToCollect(callback, args)
{
	// For testing use these variables, will become pulled from settings
	//Homey.log(Object.keys(gdates));

	if( typeof gdates[ args.trash_type.toUpperCase() ] === 'undefined' )
	{
		if(manualInput)
		{
			var message = __('error.typenotsupported.addviasettings');
			console.log(message);
			return callback( new Error( message ));
		}
		else
		{
			var message = __('error.typenotsupported.onyouraddress');
			console.log(message);
			return callback( new Error( message ));
		}
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
	//Homey.log(dateString);
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
					Homey.log('Success! Retrieved house information');
				}else{
					Homey.log('Error: house information has not been set');
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
				console.log('Error while looping');
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

function toDateOutputString(differenceInDaysForType)
{
	if(differenceInDaysForType >= 0 && differenceInDaysForType <= 2)
	{
		return __('speech.output.timeindicator.t'+differenceInDaysForType);
	}
	else if(differenceInDaysForType <= 7)
	{
		var today = new Date()
		var dayOfWeek = (today.getDay() + differenceInDaysForType) % 7;
		return __('speech.output.next') + " " +__('speech.output.weekdays.d'+dayOfWeek);
	}
	else
	{
		return __('speech.output.in') + " " + differenceInDaysForType + " " + __('speech.output.days');
	}
}
