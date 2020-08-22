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

  // ****** MY FUNCTION *******
  // N.B.: extracting the 'effective[x]' field, where [x] = DateTime, Period, Timing or Instant types
  function getDate(ob) {
    if (typeof ob != 'undefined'){
      //i think only one of the following should be defined in any given observation
      if ("effectiveDateTime" in ob){
        if (ob.effectiveDateTime.indexOf('T') == -1){
          //this DateTime is just a date, no time
          return ob.effectiveDateTime;
        } else {
          //this DateTime includes a time, which we will discard
          return ob.effectiveDateTime.slice(0, ob.effectiveDateTime.indexOf('T'));
        }
      } else if ("effectivePeriod" in ob){
        return ob.effectivePeriod;
      } else if ("effectiveTiming" in ob){
        return ob.effectiveTiming
      } else if ("effectiveInstant" in ob){
        return ob.effectiveInstant;
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  // ***** MY FUNCTION *****
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
