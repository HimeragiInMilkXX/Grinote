import NewProjectDetailsForm from "@/components/project/new/new-project-details-form"
import { pickDefaultColor } from "@/lib/projects/colors"
import { createClient } from "@/utils/supabase/server"
import { redirectIfNotAuthenticated } from "@/utils/redirectIfNotAuthenticated"

const NewProjectDetailsPage = async () => {

    const user = await redirectIfNotAuthenticated( "/login" );
    const supabase = await createClient();

    // preselect a color the user's other projects don't use yet
    const { data } = await supabase.from( "projects" ).select( "color" ).eq( "user_id", user.id ).order( "created_at" );
    const defaultColor = pickDefaultColor( ( data ?? [] ).map( row => row.color ) );

    return (

        <NewProjectDetailsForm defaultColor={defaultColor}/>
    )

}

export default NewProjectDetailsPage
