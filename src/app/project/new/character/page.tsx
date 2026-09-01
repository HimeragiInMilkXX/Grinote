import NewProjectCharacterPanel from "@/components/project/new/character/new-project-character-panel"
import { createClient } from "@/utils/supabase/server";

const NewProjectCharacterDefPage = async () => {

    const supabase = await createClient();

    const { data: characters, error } = await supabase.from( 'characters' ).select( "id, name, group, description" )
    return (

        <NewProjectCharacterPanel characters={characters}/>

    )

}

export default NewProjectCharacterDefPage
