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
        url: 'index/map_germany.svg',
        data: '',
        dataType: 'html',
        success: function (data) {
            $('#svgContainer').html(data);
        }
    });
}

function saveVaccinations(){
    const form = $('#vaccinationForm');
    console.log(form.serialize());
}

function addRandomVaccinations(){
    console.log('RANDOM');
}
