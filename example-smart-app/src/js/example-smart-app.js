(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });

        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          p.jsondump = getBPvalues(byCodes('55284-4'));
          //p.jsondump = 'Number of BP Observations = ' + byCodes('55284-4').length;

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
      jsondump: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  // ********************************************************************************************
  // Function:  getDateFromDateTime(dt)
  // Input:     dt -> a FHIR DateTime type
  // Purpose:   returns the Date portion of a DateTime type.  Date is mandatory, but the time
  //            portion is optional and is specified by a 'T' followed by the time.  An example
  //            FHIR DateTime is:  2015-02-07T13:28:17-05:00
  // ********************************************************************************************
  function getDateFromDateTime(dt) {
    if (dt.indexOf('T') == -1){
      //this DateTime is already just a Date, no Time
      return dt;
    } else {
      //this DateTime includes a time, which we will discard
      return dt.slice(0, dt.indexOf('T'));
    }
  }

  // ********************************************************************************************
  // Function:  getDate(obs)
  // Input:     obs -> a FHIR Observation resource object
  // Purpose:   returns the Date portion of the effectiveDateTime key.  N.b. for Observation
  //            resources, the effective date/time key can be 1 of 4 options: 'effective[x]' key,
  //            where [x] = DateTime, Period, Timing or Instant types.
  // ********************************************************************************************
  function getDate(obs) {
    if (typeof obs != 'undefined'){
      //i think only one of the following should be defined in any given observation
      if ("effectiveDateTime" in obs){
        return getDateFromDateTime(obs.effectiveDateTime);
      } else if ("effectivePeriod" in obs){
        //a FHIR Period object contains a "start" and "stop" DateTime key
        return getDateFromDateTime(obs.effectivePeriod.start);
      } else if ("effectiveTiming" in obs){
        //a complex FHIR data type that can occur mulitple times
        //"event" key contains an array of DateTimes when the event occurs
        return getDateFromDateTime(obs.effectiveTiming.event[0]);
      } else if ("effectiveInstant" in obs){
        //an instant is basically a DateTime that is required to have both a date and a time,
        //specified at least to the seconds place
        return getDateFromDateTime(obs.effectiveInstant);
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  // ********************************************************************************************
  // Function:  getBPValues(BPObservations)
  // Input:     BPObservations -> an array of FHIR Observations containing BP readings
  // Purpose:   extracts the blood pressure values into a human-readable string format and lists
  //            the date of each reading.  Each value/date is on a new line in the output string.
  // ********************************************************************************************
  function getBPvalues(BPObservations) {
    var formattedBPValues = [];
    console.log('123');
    BPObservations.forEach(function(observation){
      //grab the systolic BP if it exists in this BP observation
      var sysBP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          console.log('128');
          return coding.code == '8480-6';
        });
      });
      //grab the diastolic BP if it exists in this BP observation
      var diaBP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          console.log('135');
          return coding.code == '8462-4';
        });
      });
      //if both systolic and diastolic readings exist in this observation, create a valid BP entry
      if (sysBP && diaBP) {
        //create an array entry for each reading, and add the date/time
        formattedBPValues.push(getQuantityValueAndUnit(sysBP) + ' / ' + getQuantityValueAndUnit(diaBP) + ' on ' + getDate(observation));
        console.log('143');
      }
    });
    
    var outputString = '';
    formattedBPValues.forEach(function(item){
      outputString = outputString + item + '<br>';
      console.log('150');
    });

    return outputString;

    // for dumping JSON string
    /* var tmp = BPObservations[0] instanceof Error ?
        String(BPObservations[0]) :
        JSON.stringify(BPObservations[0], null, 4);

    return tmp; */
  }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
    $('#jsondump').html(p.jsondump);
  };

})(window);
