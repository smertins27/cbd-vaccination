// Event which is triggered when document is ready
$('document').ready(() => {
    loadSVG();
    const states = document.getElementById("states");
    console.log(states.name);
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
    console.log(typeof result.percent);
    console.log(result);
    postData(result);
    
}

/**
 * Click function for adding random vaccinations
 */
function addRandomVaccinations(){
    const key = 'states';
    console.log("hello");
    console.log(states);
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



