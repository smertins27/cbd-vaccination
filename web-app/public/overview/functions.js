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
 * Submit function for adding a specific amount of vaccinations for a state
 */
function saveVaccinations(){
    const form = $('#vaccinationForm');
    console.log(form.serializeArray());
}

/**
 * Click function for adding random vaccinations
 */
function addRandomVaccinations(){
    console.log('RANDOM');
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
