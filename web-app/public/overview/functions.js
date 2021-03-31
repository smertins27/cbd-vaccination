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

/**
 * Perform send of data to backend
 * @param data Array which contains all needed data
 */
function addVaccinations(data){

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
    let vaccinations = form.serializeArray();

    let timestamp = Math.floor(new Date() / 1000);
    let result = preparePostData(timestamp);
    for (let key in vaccinations) {
        if (vaccinations.hasOwnProperty(key)){
            result[vaccinations[key].name] = vaccinations[key].value;
        }
    }

    addVaccinations(result);

    form[0].reset();
    validateForm();

}

/**
 * Click function for adding random vaccinations
 */
function addRandomVaccinations(){
    const statesObject = JSON.parse(states);
    const vaccinesObject = JSON.parse(vaccines);

    let inserts = createRandomInt(15);
    
    for (let i = 0; i <= inserts; i++) {
        let timestamp = Math.floor(new Date() / 1000)
        let countStates = createRandomInt(15);
        let countVacs = createRandomInt(5);

        let result = preparePostData(timestamp);
        
        result["statesiso"] = statesObject[countStates].iso;
        result["vaccinescode"] = vaccinesObject[countVacs].code;
        result["vac_amount"] = createRandomInt(20000);
        addVaccinations(result);
    } 
}

function preparePostData(timestamp){
    let data = {};
    data["timestamp"] = timestamp;
    data["percent"] = 0;
    data["progressId"] = 0;
    data["vacId"] = 0;
    data["vacAmountInDb"] = 0;
    data["percentageInDb"] = 0;

    return data;
}

/**
 * Method for generation a random integer with upper limit
 * @param max Number of upper limit
 * @return {number}
 */
function createRandomInt(max) {
    return Math.floor(Math.random()*Math.floor(max));
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

/**
 * Method triggered by clicking on a state of the svg
 * @param iso
 */
function clickOnState(iso){
    location.href = '/state/' + iso;
}



