// Event which is triggered when document is ready
$('document').ready(() => {
    loadSVG();
})

/**
 * Load SVG via ajax and insert it into container
 * Used for preventing long svg inline element
 */
function loadSVG() {
    $.ajax({
        type: 'GET',
        url: 'public/overview/map_germany.svg',
        data: '',
        dataType: 'html',
        success: function (data) {
            $('#svgContainer').html(data);
        }
    });
}


function postData(data){

    $.ajax({
        type: 'POST',
        url: '/vaccinations',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: function (msg) {
        
        },
        error: function(jqXHR, textStatus, err){
        
        }
    })
}

/**
 * Submit function for adding a specific amount of vaccinations for a state
 */
function saveVaccinations(){
    const form = $('#vaccinationForm');
    vaccinations = form.serializeArray();
    var result = {};
    var timestamp = Math.floor(new Date() / 1000)
    for (let key in vaccinations) {
     result[vaccinations[key].name] = vaccinations[key].value;
    }
    result["timestamp"] = timestamp;
    result["percent"] = 0;
    result["progressId"] = 0;
    result["vacId"] = 0;
    result["vacAmountInDb"] = 0;
    result["percentageInDb"] = 0;
    console.log(typeof result.percent);
    console.log(result);
    postData(result);
    
}

function saveStatesAndVaccinescode(state, vaccinescode){
    console.log(state)
    console.log(vaccinescode)
}

function createRandomInt(max) {
    return Math.floor(Math.random()*Math.floor(max));
}


/**
 * Click function for adding random vaccinations
 */
function addRandomVaccinations(){
    statesObject = JSON.parse(states);
    vaccinesObject = JSON.parse(vaccines);

    var result = {};
    var inserts = createRandomInt(15);
    
    for (let i = 0; i <= inserts; i++) {
        var timestamp = Math.floor(new Date() / 1000)
        var countStates = createRandomInt(15);
        var countVacs = createRandomInt(5); 
        
        result["statesiso"] = statesObject[countStates].iso;
        result["vaccinescode"] = vaccinesObject[countVacs].code;
        result["vac_amount"] = createRandomInt(20000);
        result["timestamp"] = timestamp;
        result["percent"] = 0;
        result["progressId"] = 0;
        result["vacId"] = 0;
        result["vacAmountInDb"] = 0;
        result["percentageInDb"] = 0;
        console.log(result)
        postData(result);
    }
    

    
}

/**
 * Change event triggered.
 * Little function for validate form and dis- or enable the submit button
 */
function validateForm(){
    const $form = $('#vaccinationForm');
    const $submitBtn = $('#vaccinationForm button[type="submit"]');
    const values = $form.serializeArray();
    const invalid = values.some(value => {
        return value.value === '';
    });

    if(invalid){
        $submitBtn.prop('disabled', true);
        $submitBtn.addClass('disabled');
    }else{
        $submitBtn.prop('disabled', false);
        $submitBtn.removeClass('disabled');
    }
}

function clickOnState(iso){
    location.href = '/state/' + iso;
}
